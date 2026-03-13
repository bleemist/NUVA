require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load universities data
const universitiesData = require('./data/universities');

const app = express();

/* ============================   MIDDLEWARE  ============================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

/* ============================   ADMIN ANALYTICS ============================ */

// Store analytics data
const analytics = {
    searches: [],
    visitors: new Set(),
    subjectFrequency: {},
    courseViews: {},
    errors: []
};

// Track visitors
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        analytics.visitors.add(clientIp);
    }
    next();
});

// Admin authentication
function requireAdmin(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey === 'Muyanja@6872@') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

// Track search
function trackSearch(data, results) {
    const searchRecord = {
        timestamp: new Date().toISOString(),
        gender: data.gender,
        level: data.level,
        oLevelWeight: data.oLevelWeight,
        subjects: data.principalSubjects || [],
        totalWeight: results.calculatedWeights?.total || 0,
        matchesFound: results.totalCourses || 0,
        university: data.university || 'Any'
    };
    
    analytics.searches.unshift(searchRecord);
    if (analytics.searches.length > 100) analytics.searches.pop();
    
    (data.principalSubjects || []).forEach(subject => {
        analytics.subjectFrequency[subject] = (analytics.subjectFrequency[subject] || 0) + 1;
    });
    
    (results.recommendations || []).forEach(course => {
        analytics.courseViews[course.code] = (analytics.courseViews[course.code] || 0) + 1;
    });
}

/* ============================   UNIVERSITIES FILE MANAGEMENT ============================ */

const UNIVERSITIES_FILE = path.join(__dirname, 'data', 'universities.js');

async function readUniversitiesFile() {
    try {
        const data = await fs.promises.readFile(UNIVERSITIES_FILE, 'utf8');
        const match = data.match(/module\.exports\s*=\s*({[\s\S]+});/);
        if (match) {
            return new Function('return ' + match[1])();
        }
        throw new Error('Invalid universities file format');
    } catch (error) {
        console.error('Error reading universities file:', error);
        throw error;
    }
}

async function writeUniversitiesFile(universities) {
    try {
        const fileContent = `module.exports = ${JSON.stringify(universities, null, 2)};`;
        await fs.promises.writeFile(UNIVERSITIES_FILE, fileContent, 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing universities file:', error);
        throw error;
    }
}

/* ============================   CONFIGURATION & HELPERS ============================ */

const gradePoints = {
    A: 6, B: 5, C: 4,
    D: 3, E: 2, O: 1, F: 0
};

// Subject mapping
const subjectMapping = {
    math: ['mathematics', 'math', 'maths'],
    physics: ['physics'],
    chemistry: ['chemistry'],
    biology: ['biology'],
    economics: ['economics'],
    geography: ['geography'],
    history: ['history'],
    english: ['english', 'literature', 'lit', 'english language'],
    fineart: ['fine art', 'art', 'drawing'],
    technicaldrawing: ['technical drawing', 'td', 'geometry'],
    computer: ['computer', 'ict', 'computer studies', 'computing'],
    agriculture: ['agriculture', 'agri'],
    entrepreneurship: ['entrepreneurship', 'entrep', 'business'],
    foodnutrition: ['food & nutrition', 'foods', 'nutrition'],
    religious: ['religious education', 'cre', 'ire', 'divinity'],
    kiswahili: ['kiswahili'],
    french: ['french'],
    german: ['german'],
    luganda: ['luganda'],
    music: ['music'],
    physical: ['physical education', 'pe', 'sports']
};

function matchSubject(studentSubject = "", requiredSubject = "") {
    const student = studentSubject.toLowerCase().trim();
    const required = requiredSubject.toLowerCase().trim();

    if (student === required) return true;

    for (const variations of Object.values(subjectMapping)) {
        if (variations.includes(student) && variations.includes(required)) {
            return true;
        }
    }

    return student.includes(required) || required.includes(student);
}

/* ============================   WEIGHT CALCULATION ============================ */

function analyzeUniversityEssentialSubjects(university) {
    const essentialCounts = {};
    if (!university || !university.courseRequirements) return essentialCounts;
    
    Object.values(university.courseRequirements).forEach(course => {
        if (course.essentialSubjects && Array.isArray(course.essentialSubjects)) {
            course.essentialSubjects.forEach(subject => {
                const normalizedSubject = subject.toLowerCase().trim();
                essentialCounts[normalizedSubject] = (essentialCounts[normalizedSubject] || 0) + 1;
            });
        }
    });
    return essentialCounts;
}

function getSelectedUniversity(universityName) {
    if (!universityName || universityName === 'Any University') return null;
    
    let found = Object.values(universitiesData).find(uni => 
        uni.name && uni.name.toLowerCase().includes(universityName.toLowerCase())
    );
    if (found) return found;
    
    const uniKey = Object.keys(universitiesData).find(key => 
        key.toLowerCase().includes(universityName.toLowerCase().replace(/\s+/g, ''))
    );
    return uniKey ? universitiesData[uniKey] : null;
}

function determineEssentialSubjects(userSubjects, university) {
    if (!university) return [];
    const essentialCounts = analyzeUniversityEssentialSubjects(university);
    if (Object.keys(essentialCounts).length === 0) return [];
    
    const subjectScores = userSubjects.map(subject => {
        let score = 0;
        Object.entries(essentialCounts).forEach(([essSubject, count]) => {
            if (matchSubject(subject, essSubject)) score += count;
        });
        return { subject, score };
    });
    
    subjectScores.sort((a, b) => b.score - a.score);
    return subjectScores
        .filter(item => item.score > 0)
        .slice(0, 2)
        .map(item => item.subject);
}

function calculateCourseWeight(studentData, principalSubjects, principalGrades, courseReq) {
    if (!courseReq) return 0;

    let total = parseFloat(studentData.oLevelWeight) || 0;

    if (studentData.gender?.toLowerCase() === "female") {
        total += 1.5;
    }

    // UPDATED: Use subsidiaryPoints that combines GP and other subsidiary
    if (studentData.subsidiaryPoints === 1) {
        total += 1;
    }

    let subjectDetails = principalSubjects.map((subject, index) => {
        const grade = principalGrades[index]?.toUpperCase();
        const points = gradePoints[grade] || 0;
        return { subject, points, grade };
    });

    subjectDetails.sort((a, b) => b.points - a.points);
    subjectDetails = subjectDetails.slice(0, 3);

    let essentialCount = 0;
    let essentialWeight = 0;
    let relevantWeight = 0;

    subjectDetails.forEach(item => {
        const isEssential = (courseReq.essentialSubjects || []).some(req => matchSubject(item.subject, req));

        if (isEssential && essentialCount < 2) {
            essentialWeight += item.points * 3;
            essentialCount++;
        } else {
            relevantWeight += item.points * 2;
        }
    });

    total += essentialWeight + relevantWeight;
    return Number(total.toFixed(1));
}

function meetsSubjectRequirements(courseReq, principalSubjects) {
    if (!courseReq?.requiredSubjects) return true;
    if (courseReq.requiredSubjects.includes("any") || courseReq.requiredSubjects.includes("Any")) return true;

    return courseReq.requiredSubjects.every(required =>
        principalSubjects.some(studentSubj => matchSubject(studentSubj, required))
    );
}

function getEligibleCourses(studentData, principalSubjects, principalGrades) {
    const eligibleCourses = [];

    Object.entries(universitiesData).forEach(([uniKey, uni]) => {
        const { courseRequirements, courseNames = {}, cutOffPoints = {}, name: uniName = uniKey } = uni;

        Object.entries(courseRequirements || {}).forEach(([code, requirements]) => {
            const cutOff = cutOffPoints[code];
            if (cutOff === undefined) return;

            if (!meetsSubjectRequirements(requirements, principalSubjects)) return;

            const weight = calculateCourseWeight(
                studentData,
                principalSubjects,
                principalGrades,
                requirements
            );

            const matchScore = cutOff > 0 ? Math.min(100, Math.round((weight / cutOff) * 100)) : 100;

            if (weight >= cutOff) {
                eligibleCourses.push({
                    code,
                    name: courseNames[code] || code,
                    faculty: requirements.faculty || "Unknown",
                    duration: requirements.duration || "Unknown",
                    cutOff,
                    yourWeight: weight,
                    matchScore,
                    programType: requirements.programType || "Unknown",
                    university: uniName,
                    essentialSubjects: requirements.essentialSubjects || [],
                    requiredSubjects: requirements.requiredSubjects || []
                });
            }
        });
    });

    return eligibleCourses.sort((a, b) => b.yourWeight - a.yourWeight);
}

function buildWeightBreakdown(data, principalSubjects, principalGrades, recommendations) {
    const weights = {
        oLevel: data.oLevelWeight || 0,
        genderBonus: data.gender === 'female' ? 1.5 : 0,
        subsidiary: data.subsidiaryPoints || 0,
        principalSubjects: [],
        essentialTotal: 0,
        otherTotal: 0,
        total: 0
    };

    let essentialTotal = 0;
    let otherTotal = 0;

    if (principalSubjects.length === 0) {
        weights.total = Number((weights.oLevel + weights.genderBonus + weights.subsidiary).toFixed(1));
        return weights;
    }

    let referenceEssentials = [];
    if (recommendations.length > 0) {
        referenceEssentials = recommendations[0].essentialSubjects || [];
    } else {
        const selectedUni = getSelectedUniversity(data.university);
        if (selectedUni) {
            referenceEssentials = determineEssentialSubjects(principalSubjects, selectedUni);
        }
    }

    let subjectDetails = principalSubjects.map((subject, i) => {
        const grade = principalGrades[i];
        const points = gradePoints[grade] || 0;
        return { subject, grade, points };
    });

    subjectDetails.sort((a, b) => b.points - a.points);
    subjectDetails = subjectDetails.slice(0, 3);

    let essentialCount = 0;

    subjectDetails.forEach(item => {
        const isEssential = referenceEssentials.some(es => matchSubject(item.subject, es));

        let multiplier = 2;
        let category = 'Relevant';

        if (isEssential && essentialCount < 2) {
            multiplier = 3;
            category = 'Essential';
            essentialCount++;
        }

        const weighted = item.points * multiplier;

        weights.principalSubjects.push({
            subject: item.subject,
            grade: item.grade,
            points: item.points,
            multiplier,
            weightedPoints: weighted,
            category
        });

        if (multiplier === 3) essentialTotal += weighted;
        else otherTotal += weighted;
    });

    weights.essentialTotal = essentialTotal;
    weights.otherTotal = otherTotal;
    weights.total = Number((weights.oLevel + weights.genderBonus + weights.subsidiary + essentialTotal + otherTotal).toFixed(1));

    return weights;
}

/* ============================   API ENDPOINTS ============================ */

// ===== Course Recommendation Endpoint =====
app.post('/api/submit-subjects', (req, res) => {
    try {
        const rawData = req.body;

        if (!rawData.gender || !rawData.level) {
            return res.status(400).json({
                success: false,
                message: "Gender and education level are required"
            });
        }

        // UPDATED: Handle separate subsidiary fields
        let subsidiaryPoints = 0;
        
        // Check General Paper result
        if (rawData.gpResult === '1') {
            subsidiaryPoints = 1;
        }
        
        // Check other subsidiary result (only counts if GP not passed)
        if (subsidiaryPoints === 0 && rawData.subsidiaryResult === '1') {
            subsidiaryPoints = 1;
        }

        // Store both subsidiary values for analytics/debugging
        const subsidiarySubject = rawData.subsidiarySubject || 'None';

        const data = {
            gender: (rawData.gender || '').toLowerCase().trim(),
            level: (rawData.level || '').trim(),
            oLevelWeight: parseFloat(rawData.oLevelWeight) || 0,
            subsidiaryPoints: subsidiaryPoints,
            subsidiarySubject: subsidiarySubject,
            gpResult: rawData.gpResult || '0',
            university: (rawData.university || '').trim()
        };

        if (isNaN(data.oLevelWeight) || data.oLevelWeight < 0 || data.oLevelWeight > 3) {
            return res.status(400).json({
                success: false,
                message: "O-Level weight must be a number between 0 and 3"
            });
        }

        const principalSubjects = [];
        const principalGrades = [];

        for (let i = 1; i <= 3; i++) {
            const subject = (rawData[`principal${i}`] || '').trim();
            const grade = (rawData[`principalGrade${i}`] || '').trim().toUpperCase();

            if (subject && grade && ['A','B','C','D','E','F','O'].includes(grade)) {
                principalSubjects.push(subject);
                principalGrades.push(grade);
            }
        }

        if (principalSubjects.length === 0 && data.level === 'A-Level') {
            return res.status(400).json({
                success: false,
                message: "At least one principal subject with valid grade (A-O) is required for A-Level"
            });
        }

        let recommendations = getEligibleCourses(data, principalSubjects, principalGrades);

        let filterMessage = null;
        if (data.university && data.university !== 'Any University' && data.university.trim() !== '') {
            const lowerUni = data.university.toLowerCase();
            const originalCount = recommendations.length;

            recommendations = recommendations.filter(course => 
                course.university.toLowerCase().includes(lowerUni)
            );

            if (recommendations.length === 0 && originalCount > 0) {
                filterMessage = `No matching courses found at ${data.university} with your combination.`;
            }
        }

        const weights = buildWeightBreakdown(data, principalSubjects, principalGrades, recommendations);

        trackSearch({
            ...data,
            principalSubjects
        }, {
            calculatedWeights: weights,
            totalCourses: recommendations.length,
            recommendations
        });

        res.json({
            success: true,
            totalCourses: recommendations.length,
            recommendations: recommendations.slice(0, 15),
            calculatedWeights: weights,
            principalSubjectsUsed: principalSubjects,
            principalGradesUsed: principalGrades,
            studentData: {
                gender: data.gender,
                level: data.level,
                oLevelWeight: data.oLevelWeight,
                subsidiaryPoints: data.subsidiaryPoints,
                selectedUniversity: data.university || null,
                // Include subsidiary details for debugging/analytics
                gpResult: data.gpResult,
                subsidiarySubject: data.subsidiarySubject
            },
            filterMessage: filterMessage || null
        });

    } catch (error) {
        analytics.errors.push({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: error.message
        });
        
        console.error("API Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while calculating recommendations"
        });
    }
});

// Debug endpoint
app.get('/api/debug/universities', (req, res) => {
    const summary = {};
    Object.entries(universitiesData).forEach(([key, uni]) => {
        summary[key] = {
            name: uni.name || key,
            courseCount: Object.keys(uni.courseRequirements || {}).length,
            cutoffCount: Object.keys(uni.cutOffPoints || {}).length
        };
    });
    res.json({
        totalUniversities: Object.keys(universitiesData).length,
        summary
    });
});

/* ============================   ADMIN API ENDPOINTS ============================ */

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    let popularCourse = 'None';
    let maxViews = 0;
    Object.entries(analytics.courseViews).forEach(([code, views]) => {
        if (views > maxViews) {
            maxViews = views;
            popularCourse = code;
        }
    });

    const avgWeight = analytics.searches.length > 0
        ? analytics.searches.reduce((sum, s) => sum + s.totalWeight, 0) / analytics.searches.length
        : 0;

    const subjectEntries = Object.entries(analytics.subjectFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const totalCourses = Object.values(universitiesData)
        .reduce((sum, uni) => sum + Object.keys(uni.courseRequirements || {}).length, 0);

    res.json({
        totalSearches: analytics.searches.length,
        totalUniversities: Object.keys(universitiesData).length,
        totalCourses,
        uniqueVisitors: analytics.visitors.size,
        averageWeight: avgWeight,
        popularCourse: popularCourse,
        recentSearches: analytics.searches.slice(0, 20),
        recentErrors: analytics.errors.slice(0, 20),
        subjectFrequency: {
            labels: subjectEntries.map(e => e[0]),
            values: subjectEntries.map(e => e[1])
        }
    });
});

app.get('/api/admin/universities', requireAdmin, async (req, res) => {
    try {
        const universities = await readUniversitiesFile();
        res.json(universities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load universities' });
    }
});

app.get('/api/admin/courses/:university/:code', requireAdmin, async (req, res) => {
    try {
        const { university, code } = req.params;
        const universities = await readUniversitiesFile();
        
        const uni = universities[university];
        if (!uni) return res.status(404).json({ error: 'University not found' });
        
        const course = uni.courseRequirements?.[code];
        if (!course) return res.status(404).json({ error: 'Course not found' });
        
        res.json({
            name: uni.courseNames?.[code] || code,
            faculty: course.faculty || '',
            duration: course.duration || '',
            cutOff: uni.cutOffPoints?.[code] || 0,
            programType: course.programType || 'Day',
            essentialSubjects: course.essentialSubjects || [],
            requiredSubjects: course.requiredSubjects || []
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load course' });
    }
});

app.post('/api/admin/courses', requireAdmin, async (req, res) => {
    try {
        const { university, code, name, faculty, duration, cutOff, programType, essentialSubjects, requiredSubjects } = req.body;
        
        const universities = await readUniversitiesFile();
        
        if (!universities[university]) {
            universities[university] = {
                name: university.replace(/([A-Z])/g, ' $1').trim(),
                courseRequirements: {},
                cutOffPoints: {},
                courseNames: {}
            };
        }
        
        universities[university].courseRequirements[code] = {
            faculty,
            duration,
            programType,
            essentialSubjects: essentialSubjects || [],
            requiredSubjects: requiredSubjects || []
        };
        
        universities[university].cutOffPoints[code] = cutOff;
        universities[university].courseNames[code] = name;
        
        await writeUniversitiesFile(universities);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save course' });
    }
});

app.put('/api/admin/courses', requireAdmin, async (req, res) => {
    try {
        const { university, originalCode, code, name, faculty, duration, cutOff, programType, essentialSubjects, requiredSubjects } = req.body;
        
        const universities = await readUniversitiesFile();
        
        if (originalCode && originalCode !== code) {
            delete universities[university].courseRequirements[originalCode];
            delete universities[university].cutOffPoints[originalCode];
            delete universities[university].courseNames[originalCode];
        }
        
        universities[university].courseRequirements[code] = {
            faculty,
            duration,
            programType,
            essentialSubjects: essentialSubjects || [],
            requiredSubjects: requiredSubjects || []
        };
        
        universities[university].cutOffPoints[code] = cutOff;
        universities[university].courseNames[code] = name;
        
        await writeUniversitiesFile(universities);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update course' });
    }
});

app.delete('/api/admin/courses', requireAdmin, async (req, res) => {
    try {
        const { university, code } = req.body;
        
        const universities = await readUniversitiesFile();
        
        if (universities[university]) {
            delete universities[university].courseRequirements[code];
            delete universities[university].cutOffPoints[code];
            delete universities[university].courseNames[code];
        }
        
        await writeUniversitiesFile(universities);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

app.post('/api/admin/clear-logs', requireAdmin, (req, res) => {
    analytics.searches = [];
    analytics.errors = [];
    res.json({ success: true });
});

/* ============================   HEALTH CHECK ============================ */

app.get('/api/health', (req, res) => {
    const totalCourses = Object.values(universitiesData)
        .reduce((sum, uni) => sum + Object.keys(uni.courseRequirements || {}).length, 0);

    res.json({
        status: "OK",
        totalUniversities: Object.keys(universitiesData).length,
        totalCourses,
        timestamp: new Date().toISOString()
    });
});

/* ============================   STATIC ROUTES ============================ */

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static('public'));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ============================  START SERVER  ============================ */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NUVA server running on http://localhost:${PORT}`);
    console.log(`✅ Fully compatible with new O-Level grade-count input (D1/D2, C3-C6, etc.)`);
    console.log(`✅ Separate General Paper and Other Subsidiary fields supported`);
    console.log(`✅ Admin panel available at /admin.html`);
    console.log(`✅ Analytics tracking enabled`);
    console.log(`✅ Debug endpoint: /api/debug/universities`);
});