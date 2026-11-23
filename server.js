require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load universities data
let universitiesData = require('./data/universities');

const app = express();
const serverStartTime = Date.now();

/* ============================   MIDDLEWARE  ============================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

/* ============================   ADMIN ANALYTICS & PERSISTENCE ============================ */

const ANALYTICS_FILE = path.join(__dirname, 'data', 'analytics.json');

// Store analytics data in memory
const analytics = {
    searches: [],
    visitors: new Set(),
    subjectFrequency: {},
    courseViews: {},
    errors: [],
    reports: [],
    totalSearchesCount: 0
};

// Load persistent analytics on startup
function loadAnalytics() {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            const raw = fs.readFileSync(ANALYTICS_FILE, 'utf8');
            const data = JSON.parse(raw);
            analytics.searches = Array.isArray(data.searches) ? data.searches : [];
            analytics.visitors = new Set(Array.isArray(data.visitors) ? data.visitors : []);
            analytics.subjectFrequency = (data.subjectFrequency && typeof data.subjectFrequency === 'object') ? data.subjectFrequency : {};
            analytics.courseViews = (data.courseViews && typeof data.courseViews === 'object') ? data.courseViews : {};
            analytics.errors = Array.isArray(data.errors) ? data.errors : [];
            analytics.reports = Array.isArray(data.reports) ? data.reports : [];
            analytics.totalSearchesCount = typeof data.totalSearchesCount === 'number'
                ? data.totalSearchesCount
                : analytics.searches.length;
            console.log(`[NUVA Analytics] Loaded persistent analytics: ${analytics.totalSearchesCount} searches, ${analytics.visitors.size} visitors, ${analytics.reports.length} reports.`);
        } else {
            saveAnalyticsSync();
            console.log('[NUVA Analytics] Initialized new persistent analytics at data/analytics.json');
        }
    } catch (err) {
        console.error('[NUVA Analytics] Failed to load analytics.json, using defaults:', err.message);
    }
}

// Debounced save for high-frequency operations
let saveTimeout = null;
function saveAnalytics() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveAnalyticsSync();
    }, 500);
}

// Synchronous atomic save for critical updates and shutdowns
function saveAnalyticsSync() {
    try {
        const payload = {
            totalSearchesCount: analytics.totalSearchesCount || analytics.searches.length,
            searches: analytics.searches.slice(0, 200),
            visitors: Array.from(analytics.visitors),
            subjectFrequency: analytics.subjectFrequency,
            courseViews: analytics.courseViews,
            errors: analytics.errors.slice(0, 100),
            reports: analytics.reports.slice(0, 100),
            lastSaved: new Date().toISOString()
        };
        const tempPath = ANALYTICS_FILE + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
        fs.renameSync(tempPath, ANALYTICS_FILE);
    } catch (err) {
        console.error('[NUVA Analytics] Error persisting analytics to disk:', err.message);
    }
}

// Initialize persistent analytics
loadAnalytics();

// Process exit handlers to guarantee analytics flush
process.on('SIGINT', () => { saveAnalyticsSync(); process.exit(0); });
process.on('SIGTERM', () => { saveAnalyticsSync(); process.exit(0); });
process.on('beforeExit', () => { saveAnalyticsSync(); });

// Track visitors across pages and APIs (skip static asset requests)
app.use((req, res, next) => {
    const isStaticAsset = /\.(png|jpg|jpeg|gif|svg|ico|css|js|txt|xml|json)$/i.test(req.path);
    if (!isStaticAsset) {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        if (!analytics.visitors.has(clientIp)) {
            analytics.visitors.add(clientIp);
            saveAnalytics();
        }
    }
    next();
});

// Admin authentication
function requireAdmin(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    const validKey = process.env.ADMIN_KEY || 'Muyanja@6872@';
    if (adminKey === validKey) {
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
    if (analytics.searches.length > 200) analytics.searches.pop();
    analytics.totalSearchesCount = (analytics.totalSearchesCount || 0) + 1;
    
    (data.principalSubjects || []).forEach(subject => {
        analytics.subjectFrequency[subject] = (analytics.subjectFrequency[subject] || 0) + 1;
    });
    
    (results.recommendations || []).forEach(course => {
        analytics.courseViews[course.code] = (analytics.courseViews[course.code] || 0) + 1;
    });

    saveAnalytics();
}

/* ============================   UNIVERSITIES FILE MANAGEMENT ============================ */

const UNIVERSITIES_FILE = path.join(__dirname, 'data', 'universities.js');

function readUniversitiesFile() {
    try {
        delete require.cache[require.resolve('./data/universities')];
        return require('./data/universities');
    } catch (error) {
        console.error('Error reading universities file:', error);
        throw error;
    }
}

async function writeUniversitiesFile(universities) {
    try {
        const fileContent = `module.exports = ${JSON.stringify(universities, null, 2)};`;
        await fs.promises.writeFile(UNIVERSITIES_FILE, fileContent, 'utf8');
        delete require.cache[require.resolve('./data/universities')];
        // CRITICAL: Live sync in memory so all recommendation endpoints update instantly
        universitiesData = universities;
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

    // UPDATED: subsidiaryPoints now correctly adds BOTH GP and other subsidiary (0, 1, or 2)
    if (studentData.subsidiaryPoints) {
        total += studentData.subsidiaryPoints;
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

        // ===== UPDATED: Independent subsidiary calculation =====
        // General Paper and Other Subsidiary are now INDEPENDENT (each adds +1)
        let subsidiaryPoints = 0;

        // General Paper pass = +1 (always independent)
        const gp = rawData.gpResult || rawData.generalPaper;
        if (gp === '1' || gp === 1 || gp === true || String(gp).toLowerCase() === 'passed' || String(gp).toLowerCase() === 'pass') {
            subsidiaryPoints += 1;
        }

        // Other subsidiary subject pass = +1 (completely independent from GP)
        const otherSub = rawData.subsidiaryResult || rawData.otherSubsidiary;
        if (otherSub === '1' || otherSub === 1 || otherSub === true || String(otherSub).toLowerCase() === 'passed' || String(otherSub).toLowerCase() === 'pass') {
            subsidiaryPoints += 1;
        }

        // Store both subsidiary values for analytics/debugging
        const subsidiarySubject = rawData.subsidiarySubject || 'None';
        const gpPassed = (gp === '1' || gp === 1 || gp === true || String(gp).toLowerCase() === 'passed') ? 1 : 0;
        const otherSubsidiaryPassed = (otherSub === '1' || otherSub === 1 || otherSub === true || String(otherSub).toLowerCase() === 'passed') ? 1 : 0;

        const data = {
            gender: (rawData.gender || '').toLowerCase().trim(),
            level: (rawData.level || '').trim(),
            oLevelWeight: parseFloat(rawData.oLevelWeight) || 0,
            subsidiaryPoints: subsidiaryPoints, // Now correctly adds 0, 1, or 2
            subsidiarySubject: subsidiarySubject,
            gpResult: gpPassed,
            otherSubsidiaryResult: otherSubsidiaryPassed,
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
                otherSubsidiaryResult: data.otherSubsidiaryResult,
                subsidiarySubject: data.subsidiarySubject
            },
            filterMessage: filterMessage || null
        });

    } catch (error) {
        analytics.errors.unshift({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: error.message
        });
        if (analytics.errors.length > 100) analytics.errors.pop();
        saveAnalytics();
        
        console.error("API Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while calculating recommendations"
        });
    }
});

/* ============================   PUBLIC LIVE APIs ============================ */

// Public live system stats (used by landing page and mobile clients)
app.get('/api/stats', (req, res) => {
    try {
        const totalCourses = Object.values(universitiesData)
            .reduce((sum, uni) => sum + Object.keys(uni.courseRequirements || {}).length, 0);
        const totalUniversities = Object.keys(universitiesData).length;

        let popularCourse = 'None';
        let maxViews = 0;
        Object.entries(analytics.courseViews || {}).forEach(([code, views]) => {
            if (views > maxViews) {
                maxViews = views;
                popularCourse = code;
            }
        });

        res.json({
            success: true,
            totalUniversities,
            totalCourses,
            totalSearches: analytics.totalSearchesCount || analytics.searches.length,
            uniqueVisitors: analytics.visitors.size,
            popularCourse,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
    }
});

// Public live universities list
app.get('/api/universities', (req, res) => {
    try {
        const list = Object.entries(universitiesData).map(([key, uni]) => ({
            key,
            name: uni.name || key,
            courseCount: Object.keys(uni.courseRequirements || {}).length,
            cutoffCount: Object.keys(uni.cutOffPoints || {}).length
        }));
        res.json({
            success: true,
            total: list.length,
            universities: list
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch universities' });
    }
});

// Debug endpoint with live status
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
    Object.entries(analytics.courseViews || {}).forEach(([code, views]) => {
        if (views > maxViews) {
            maxViews = views;
            popularCourse = code;
        }
    });

    const avgWeight = analytics.searches.length > 0
        ? analytics.searches.reduce((sum, s) => sum + (s.totalWeight || 0), 0) / analytics.searches.length
        : 0;

    const subjectEntries = Object.entries(analytics.subjectFrequency || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const totalCourses = Object.values(universitiesData)
        .reduce((sum, uni) => sum + Object.keys(uni.courseRequirements || {}).length, 0);

    res.json({
        totalSearches: analytics.totalSearchesCount || analytics.searches.length,
        totalUniversities: Object.keys(universitiesData).length,
        totalCourses,
        uniqueVisitors: analytics.visitors.size,
        totalReports: analytics.reports.length,
        averageWeight: Number(avgWeight.toFixed(1)),
        popularCourse: popularCourse,
        recentSearches: analytics.searches.slice(0, 50),
        recentErrors: analytics.errors.slice(0, 20),
        recentReports: analytics.reports.slice(0, 50),
        subjectFrequency: {
            labels: subjectEntries.map(e => e[0]),
            values: subjectEntries.map(e => e[1])
        }
    });
});

app.get('/api/admin/universities', requireAdmin, (req, res) => {
    try {
        const universities = readUniversitiesFile();
        res.json(universities);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load universities' });
    }
});

app.get('/api/admin/courses/:university/:code', requireAdmin, (req, res) => {
    try {
        const { university, code } = req.params;
        const universities = readUniversitiesFile();
        
        let uni = universities[university];
        if (!uni) {
            uni = Object.values(universities).find(u => u.name && u.name.toLowerCase() === university.toLowerCase());
        }
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
        if (!university || !code || !name) {
            return res.status(400).json({ error: 'University, course code, and course name are required' });
        }
        
        const universities = readUniversitiesFile();
        
        if (!universities[university]) {
            universities[university] = {
                name: university.replace(/([A-Z])/g, ' $1').trim(),
                courseRequirements: {},
                cutOffPoints: {},
                courseNames: {}
            };
        }
        
        universities[university].courseRequirements[code] = {
            faculty: faculty || '',
            duration: duration || '3 Years',
            programType: programType || 'Day',
            essentialSubjects: essentialSubjects || [],
            requiredSubjects: requiredSubjects || []
        };
        
        universities[university].cutOffPoints[code] = parseFloat(cutOff) || 0;
        universities[university].courseNames[code] = name;
        
        await writeUniversitiesFile(universities);
        res.json({ success: true, message: `Course ${code} saved and synchronized in memory.` });
    } catch (error) {
        console.error('Error saving course:', error);
        res.status(500).json({ error: 'Failed to save course' });
    }
});

app.put('/api/admin/courses', requireAdmin, async (req, res) => {
    try {
        const { university, originalCode, code, name, faculty, duration, cutOff, programType, essentialSubjects, requiredSubjects } = req.body;
        if (!university || !code || !name) {
            return res.status(400).json({ error: 'University, course code, and course name are required' });
        }
        
        const universities = readUniversitiesFile();
        
        if (!universities[university]) {
            return res.status(404).json({ error: 'University not found' });
        }
        
        if (originalCode && originalCode !== code) {
            if (universities[university].courseRequirements) delete universities[university].courseRequirements[originalCode];
            if (universities[university].cutOffPoints) delete universities[university].cutOffPoints[originalCode];
            if (universities[university].courseNames) delete universities[university].courseNames[originalCode];
        }

        if (!universities[university].courseRequirements) universities[university].courseRequirements = {};
        if (!universities[university].cutOffPoints) universities[university].cutOffPoints = {};
        if (!universities[university].courseNames) universities[university].courseNames = {};
        
        universities[university].courseRequirements[code] = {
            faculty: faculty || '',
            duration: duration || '3 Years',
            programType: programType || 'Day',
            essentialSubjects: essentialSubjects || [],
            requiredSubjects: requiredSubjects || []
        };
        
        universities[university].cutOffPoints[code] = parseFloat(cutOff) || 0;
        universities[university].courseNames[code] = name;
        
        await writeUniversitiesFile(universities);
        res.json({ success: true, message: `Course ${code} updated and synchronized in memory.` });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ error: 'Failed to update course' });
    }
});

app.delete('/api/admin/courses', requireAdmin, async (req, res) => {
    try {
        const { university, code } = req.body;
        if (!university || !code) {
            return res.status(400).json({ error: 'University and course code are required' });
        }
        
        const universities = readUniversitiesFile();
        
        if (universities[university]) {
            if (universities[university].courseRequirements) delete universities[university].courseRequirements[code];
            if (universities[university].cutOffPoints) delete universities[university].cutOffPoints[code];
            if (universities[university].courseNames) delete universities[university].courseNames[code];
        }
        
        await writeUniversitiesFile(universities);
        res.json({ success: true, message: `Course ${code} deleted and synchronized in memory.` });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

// Get user problem reports
app.get('/api/admin/reports', requireAdmin, (req, res) => {
    res.json({
        total: analytics.reports.length,
        reports: analytics.reports
    });
});

// Delete / dismiss a problem report
app.delete('/api/admin/reports/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const initialLen = analytics.reports.length;
    analytics.reports = analytics.reports.filter(r => r.id !== id);
    if (analytics.reports.length < initialLen) {
        saveAnalyticsSync();
        res.json({ success: true, message: 'Report dismissed' });
    } else {
        res.status(404).json({ error: 'Report not found' });
    }
});

// Clear analytics logs
app.post('/api/admin/clear-logs', requireAdmin, (req, res) => {
    analytics.searches = [];
    analytics.errors = [];
    analytics.totalSearchesCount = 0;
    if (req.body && req.body.clearReports) {
        analytics.reports = [];
    }
    saveAnalyticsSync();
    res.json({ success: true, message: 'Logs cleared and persisted' });
});

/* ============================   USER REPORT ENDPOINT ============================ */

app.post('/api/report-problem', (req, res) => {
    try {
        const { problem, contact, details } = req.body;
        if (!problem || !problem.trim()) {
            return res.status(400).json({ success: false, message: 'Please describe the problem.' });
        }
        const report = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            problem: problem.trim(),
            contact: contact ? contact.trim() : null,
            details: details || null
        };
        analytics.reports.unshift(report);
        if (analytics.reports.length > 100) analytics.reports.pop();
        console.log(`[NUVA] New problem report received at ${report.timestamp}`);
        saveAnalyticsSync();
        res.json({ success: true, message: 'Thank you! Your report has been submitted.' });
    } catch (err) {
        console.error('Error handling problem report:', err);
        res.status(500).json({ success: false, message: 'Server error processing report' });
    }
});

/* ============================   HEALTH CHECK ============================ */

app.get('/api/health', (req, res) => {
    const totalCourses = Object.values(universitiesData)
        .reduce((sum, uni) => sum + Object.keys(uni.courseRequirements || {}).length, 0);

    res.json({
        status: "OK",
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
        totalUniversities: Object.keys(universitiesData).length,
        totalCourses,
        totalSearches: analytics.totalSearchesCount || analytics.searches.length,
        uniqueVisitors: analytics.visitors.size,
        timestamp: new Date().toISOString()
    });
});

/* ============================   SITEMAPS   ============================ */

// Serve JSON sitemap (fresh read)
app.get('/sitemap.json', (req, res) => {
    try {
        const sitemapPath = path.join(__dirname, 'public', 'sitemap.json');
        const sitemapRaw = fs.readFileSync(sitemapPath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(sitemapRaw);
    } catch (e) {
        res.status(500).json({ error: 'Sitemap not found' });
    }
});

// Serve XML sitemap (auto-generated from live JSON)
app.get('/sitemap.xml', (req, res) => {
    try {
        const sitemapPath = path.join(__dirname, 'public', 'sitemap.json');
        const sitemapData = JSON.parse(fs.readFileSync(sitemapPath, 'utf8'));
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        sitemapData.pages.forEach(page => {
            xml += '  <url>\n';
            xml += `    <loc>${sitemapData.domain}${page.path}</loc>\n`;
            xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
            xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
            xml += `    <priority>${page.priority}</priority>\n`;
            xml += '  </url>\n';
        });
        
        xml += '</urlset>';
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (e) {
        res.status(500).send('Error generating sitemap XML');
    }
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
    console.log(`✅ UPDATED: General Paper and Other Subsidiary are now INDEPENDENT (up to +2 total)`);
    console.log(`✅ Admin panel available at /admin.html`);
    console.log(`✅ Analytics tracking enabled`);
    console.log(`✅ Debug endpoint: /api/debug/universities`);
});