const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Load universities data (must export as object with university keys)
const universitiesData = require('./data/universities');

const app = express();

/* ============================   MIDDLEWARE  ============================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

/* ============================   USER STORAGE ============================ */

const USERS_FILE = path.join(__dirname, 'users.json');

function ensureUsersFileExists() {
    if (!fs.existsSync(USERS_FILE)) {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
            console.log(`Created empty users file: ${USERS_FILE}`);
        } catch (err) {
            console.error('Failed to create users.json file:', err);
        }
    }
}

ensureUsersFileExists();

function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading users:', err);
        return [];
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving users:', err);
    }
}

/* ============================   USER API ENDPOINTS ============================ */

app.post('/signup', async (req, res) => {
    try {
        const userData = req.body;

        if (!userData.email || !userData.phone || !userData.password) {
            return res.status(400).json({
                success: false,
                error: 'Email, phone number, and password are required'
            });
        }

        ensureUsersFileExists();
        const users = loadUsers();

        const exists = users.some(u =>
            u.email.toLowerCase() === userData.email.toLowerCase().trim() ||
            u.phone === userData.phone.trim()
        );

        if (exists) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email or phone number already exists.'
            });
        }

        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        const newUser = {
            id: 'user_' + Date.now() + Math.random().toString(36).slice(2, 10),
            firstName: (userData.firstName || '').trim(),
            lastName: (userData.lastName || '').trim(),
            gender: userData.gender || '',
            dob: userData.dob || '',
            email: userData.email.trim().toLowerCase(),
            phone: userData.phone.trim(),
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        };

        users.push(newUser);
        saveUsers(users);

        const safeUser = { ...newUser };
        delete safeUser.password;

        res.json({
            success: true,
            message: 'Account created successfully!',
            user: safeUser
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during registration. Please try again later.'
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;

        if (!emailOrPhone || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email/phone and password are required'
            });
        }

        ensureUsersFileExists();
        const users = loadUsers();

        const user = users.find(u =>
            (u.email === emailOrPhone.trim().toLowerCase() ||
             u.phone === emailOrPhone.trim())
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email/phone or password.'
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email/phone or password.'
            });
        }

        user.lastLogin = new Date().toISOString();
        saveUsers(users);

        const safeUser = { ...user };
        delete safeUser.password;

        res.json({
            success: true,
            message: 'Login successful!',
            user: safeUser
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login. Please try again later.'
        });
    }
});

app.get('/check-user', (req, res) => {
    const { email, phone } = req.query;

    if (!email && !phone) {
        return res.status(400).json({ exists: false, error: 'Provide email or phone' });
    }

    ensureUsersFileExists();
    const users = loadUsers();
    let exists = false;

    if (email) {
        exists = users.some(u => u.email === email.trim().toLowerCase());
    }
    if (phone && !exists) {
        exists = users.some(u => u.phone === phone.trim());
    }

    res.json({ exists });
});

/* ============================   CONFIGURATION  ============================ */

const gradePoints = {
    A: 6, B: 5, C: 4,
    D: 3, E: 2, O: 1, F: 0
};

const subjectMapping = {
    math: ['mathematics', 'math', 'maths'],
    physics: ['physics'],
    chemistry: ['chemistry'],
    biology: ['biology'],
    economics: ['economics'],
    geography: ['geography'],
    history: ['history'],
    english: ['english', 'literature', 'lit'],
    fineart: ['fine art', 'art'],
    technicaldrawing: ['technical drawing', 'td'],
    computer: ['computer', 'ict', 'computer studies'],
    agriculture: ['agriculture', 'agric']
};

/* ============================   HELPER FUNCTIONS  ============================ */

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

function calculateCourseWeight(studentData, principalSubjects, principalGrades, courseReq) {
    if (!courseReq) return 0;

    let total = parseFloat(studentData.oLevelWeight) || 0;

    if (studentData.gender?.toLowerCase() === "female") {
        total += 1.5;
    }

    let essentialWeight = 0;
    let otherWeight = 0;

    principalSubjects.forEach((subject, index) => {
        const grade = principalGrades[index]?.toUpperCase();
        const points = gradePoints[grade] || 0;

        const isEssential = (courseReq.essentialSubjects || [])
            .some(req => matchSubject(subject, req));

        if (isEssential) {
            essentialWeight += points * 3;
        } else {
            otherWeight += points * 2;
        }
    });

    total += essentialWeight + otherWeight;

    if (studentData.subsidiaryPoints === 1) {
        total += 1;
    }

    return Number(total.toFixed(1));
}

function meetsSubjectRequirements(courseReq, principalSubjects) {
    if (!courseReq?.requiredSubjects) return true;
    if (courseReq.requiredSubjects.includes("any") || courseReq.requiredSubjects.includes("Any")) return true;

    return courseReq.requiredSubjects.some(required =>
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

            // Safe matchScore - prevent division by zero
            const matchScore = cutOff > 0 ? Math.min(100, Math.round((weight / cutOff) * 100)) : 100;

            if (weight >= cutOff || cutOff === 0) {
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

// Helper function to build intelligent weight breakdown (forces min 2 essentials)
function buildWeightBreakdown(data, principalSubjects, principalGrades, recommendations) {
    const weights = {
        oLevel: data.oLevelWeight || 0,
        genderBonus: data.gender === 'female' ? 1.5 : 0,
        subsidiaryPoints: data.subsidiaryPoints || 0,
        generalPaper: 1,                    // Fixed +1 for every A-Level student
        principalSubjects: [],
        essentialTotal: 0,
        otherTotal: 0,
        total: 0
    };

    let essentialTotal = 0;
    let otherTotal = 0;

    if (principalSubjects.length === 0) {
        weights.total = Number(
            (weights.oLevel + weights.genderBonus + weights.subsidiaryPoints + weights.generalPaper).toFixed(1)
        );
        return weights;
    }

    // Reference essentials from top course (or fallback)
    let referenceEssentials = [];
    if (recommendations.length > 0) {
        referenceEssentials = recommendations[0].essentialSubjects || [];
    } else {
        const allEss = new Set();
        Object.values(universitiesData).forEach(uni => {
            Object.values(uni.courseRequirements || {}).forEach(req => {
                (req.essentialSubjects || []).forEach(es => allEss.add(es.toLowerCase().trim()));
            });
        });
        referenceEssentials = Array.from(allEss);
    }

    // Prepare subjects with points for prioritization
    let subjectDetails = principalSubjects.map((subject, i) => {
        const grade = principalGrades[i];
        const points = gradePoints[grade] || 0;
        return { subject, grade, points };
    });

    // Sort by points descending (best grades first)
    subjectDetails.sort((a, b) => b.points - a.points);

    // Force at least 2 essentials
    let essentialCount = 0;
    const minEssential = 2;

    subjectDetails.forEach((item) => {
        const subject = item.subject;
        const grade = item.grade;
        const points = item.points;

        const isTrueEssential = referenceEssentials.some(es => matchSubject(subject, es));

        let multiplier = 2;
        let category = 'Relevant';
        let note = 'General/Relevant subject';

        if (isTrueEssential && essentialCount < 3) {
            multiplier = 3;
            category = 'Essential';
            note = 'Essential for top matching courses';
            essentialCount++;
        }
        else if (essentialCount < minEssential) {
            multiplier = 3;
            category = 'Essential (minimum 2 forced)';
            note = 'Forced essential to meet minimum requirement of 2';
            essentialCount++;
        }

        const weighted = points * multiplier;

        weights.principalSubjects.push({
            subject,
            grade,
            points,
            multiplier,
            weightedPoints: weighted,
            category,
            note
        });

        if (multiplier === 3) essentialTotal += weighted;
        else otherTotal += weighted;
    });

    weights.essentialTotal = essentialTotal;
    weights.otherTotal = otherTotal;

    weights.total = Number(
        (weights.oLevel + weights.genderBonus + weights.subsidiaryPoints +
         weights.generalPaper + essentialTotal + otherTotal).toFixed(1)
    );

    return weights;
}

/* ============================   API ENDPOINT - submit-subjects ============================ */

app.post('/api/submit-subjects', (req, res) => {
    try {
        const rawData = req.body;

        if (!rawData.gender || !rawData.level) {
            return res.status(400).json({
                success: false,
                message: "Gender and education level are required"
            });
        }

        const data = {
            gender: (rawData.gender || '').toLowerCase().trim(),
            level: (rawData.level || '').trim(),
            oLevelWeight: parseFloat(rawData.oLevelWeight) || 0,
            subsidiaryPoints: (rawData.subsidiaryResult === '1' && 
                (rawData.subsidiarySubject === 'Mathematics' || rawData.subsidiarySubject === 'ICT')) ? 1 : 0,
            university: (rawData.university || '').trim()
        };

        if (isNaN(data.oLevelWeight) || data.oLevelWeight < 0 || data.oLevelWeight > 3) {
            return res.status(400).json({
                success: false,
                message: "O-Level weight must be a number between 0 and 3 (calculated from best 8 subjects: D1/D2=0.3, C3–C6=0.2, P7/P8=0.1)"
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

        if (principalSubjects.length === 0) {
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
                subsidiarySubject: rawData.subsidiarySubject || 'None',
                selectedUniversity: data.university || null
            },
            filterMessage: filterMessage || null
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while calculating recommendations"
        });
    }
});

/* ============================ HEALTH CHECK ============================ */

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

/* ============================  STATIC ROUTES ============================ */

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

/* ============================  START SERVER  ============================ */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NUVA server running on http://localhost:${PORT}`);
});