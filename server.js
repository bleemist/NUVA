require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// ========== Email verification dependencies ==========
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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

/* ============================   EMAIL VERIFICATION SETUP ============================ */

// Email transporter configuration - FIXED for Render (IPv4 forced)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    family: 4, // CRITICAL: Force IPv4 only (fixes Render IPv6 issue)
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
        rejectUnauthorized: false // Helps with some network issues
    },
    debug: true // Enable debug logs (remove in production)
});

// Base URL for verification links
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Store verification tokens (in production, use a database)
const verificationTokens = new Map(); // { token: { userId, email, expires } }

// Generate a secure verification token
function generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Send verification email (non-blocking)
async function sendVerificationEmail(email, firstName, token) {
    const verificationLink = `${BASE_URL}/verify-email?token=${token}`;
    
    console.log(`📧 Attempting to send verification email to ${email}`);
    
    const mailOptions = {
        from: '"NUVA" <noreply@nuva.com>',
        to: email,
        subject: 'Verify Your NUVA Account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #fe4f04;">NUVA</h1>
                    <h2 style="color: #333;">Welcome, ${firstName || 'Student'}!</h2>
                </div>
                
                <p style="font-size: 16px; line-height: 1.5; color: #555;">
                    Thank you for creating an account with NUVA. Please verify your email address to complete your registration and access all features.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" 
                       style="background: linear-gradient(90deg, #fe4f04, #ff7a2d); 
                              color: white; 
                              padding: 12px 30px; 
                              text-decoration: none; 
                              border-radius: 5px; 
                              font-weight: bold;
                              display: inline-block;">
                        Verify My Account
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #999; text-align: center;">
                    This link will expire in 24 hours. If you didn't create an account with NUVA, you can safely ignore this email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                
                <p style="font-size: 12px; color: #999; text-align: center;">
                    If the button above doesn't work, copy and paste this link into your browser:<br>
                    <span style="color: #fe4f04;">${verificationLink}</span>
                </p>
            </div>
        `,
        text: `Welcome to NUVA! Please verify your account by clicking this link: ${verificationLink} This link will expire in 24 hours.`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${email} - Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed with details:');
        console.error('- Error code:', error.code);
        console.error('- Response:', error.response);
        console.error('- Response code:', error.responseCode);
        console.error('- Command:', error.command);
        return false;
    }
}

// Queue for background email sending
const emailQueue = [];

// Process email queue in background
setInterval(() => {
    if (emailQueue.length > 0) {
        const { email, firstName, token } = emailQueue.shift();
        sendVerificationEmail(email, firstName, token)
            .catch(err => console.error('Background email error:', err));
    }
}, 1000); // Check every second

/* ============================   USER API ENDPOINTS ============================ */

// OPTIMIZED: Signup with non-blocking email
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

        // Reduced salt rounds for faster hashing (still secure)
        const saltRounds = 10;
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
            isActive: true,
            emailVerified: false
        };

        users.push(newUser);
        saveUsers(users);

        // Generate verification token
        const token = generateVerificationToken();
        
        // Store token (expires in 24 hours)
        verificationTokens.set(token, {
            userId: newUser.id,
            email: newUser.email,
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        });

        // Add to email queue (non-blocking)
        emailQueue.push({
            email: newUser.email,
            firstName: newUser.firstName,
            token: token
        });

        // Return immediately without waiting for email
        const safeUser = { ...newUser };
        delete safeUser.password;

        res.json({
            success: true,
            message: 'Account created! Please check your email to verify your account.',
            user: safeUser,
            requiresVerification: true,
            emailQueued: true
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during registration. Please try again later.'
        });
    }
});

// OPTIMIZED: Login with email verification check
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

        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                error: 'Please verify your email before logging in.',
                needsVerification: true,
                email: user.email
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

// OPTIMIZED: Email verification endpoint
app.get('/verify-email', (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.redirect('/verification-failed.html?reason=missing-token');
    }

    // Check if token exists and is valid
    const tokenData = verificationTokens.get(token);
    
    if (!tokenData) {
        return res.redirect('/verification-failed.html?reason=invalid-token');
    }

    // Check if token expired
    if (Date.now() > tokenData.expires) {
        verificationTokens.delete(token);
        return res.redirect('/verification-failed.html?reason=expired');
    }

    // Load users and update verification status
    ensureUsersFileExists();
    const users = loadUsers();
    
    const userIndex = users.findIndex(u => u.id === tokenData.userId);
    
    if (userIndex === -1) {
        return res.redirect('/verification-failed.html?reason=user-not-found');
    }

    // Mark as verified
    users[userIndex].emailVerified = true;
    users[userIndex].emailVerifiedAt = new Date().toISOString();
    saveUsers(users);

    // Clean up used token
    verificationTokens.delete(token);

    // Store user in session for auto-login
    const safeUser = { ...users[userIndex] };
    delete safeUser.password;

    // Redirect to success page with user data encoded
    const userDataBase64 = Buffer.from(JSON.stringify(safeUser)).toString('base64');
    res.redirect(`/verification-success.html?user=${userDataBase64}`);
});

// OPTIMIZED: Resend verification email
app.post('/resend-verification', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
    }

    ensureUsersFileExists();
    const users = loadUsers();
    
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.emailVerified) {
        return res.status(400).json({ success: false, error: 'Email already verified' });
    }

    // Clean up any existing tokens for this user
    for (const [token, data] of verificationTokens.entries()) {
        if (data.userId === user.id) {
            verificationTokens.delete(token);
        }
    }

    // Generate new token
    const token = generateVerificationToken();
    verificationTokens.set(token, {
        userId: user.id,
        email: user.email,
        expires: Date.now() + (24 * 60 * 60 * 1000)
    });

    // Add to email queue (non-blocking)
    emailQueue.push({
        email: user.email,
        firstName: user.firstName,
        token: token
    });

    res.json({
        success: true,
        message: 'Verification email queued for sending',
        emailQueued: true
    });
});

// Report wrong email address
app.post('/report-wrong-email', (req, res) => {
    const { email, reason } = req.body;

    console.log(`⚠️ Wrong email report: ${email} - Reason: ${reason || 'Not specified'}`);

    res.json({
        success: true,
        message: 'Thank you for reporting. Our support team will assist you shortly.'
    });
});

// Debug endpoint to verify environment variables (REMOVE IN PRODUCTION)
app.get('/debug-env', (req, res) => {
    res.json({
        emailUser: process.env.EMAIL_USER ? '✅ Set to: ' + process.env.EMAIL_USER.substring(0,3) + '...' : '❌ Missing',
        emailPass: process.env.EMAIL_PASS ? '✅ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '❌ Missing',
        baseUrl: process.env.BASE_URL || '❌ Missing'
    });
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
    computer: ['computer', 'ict', 'computer studies']
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

    // Subsidiary points: 1 point for any subsidiary pass
    if (studentData.subsidiaryResult === '1') {
        total += 1;
    }

    // Prepare subject details, limit to top 3 principals by points
    let subjectDetails = principalSubjects.map((subject, index) => {
        const grade = principalGrades[index]?.toUpperCase();
        const points = gradePoints[grade] || 0;
        return { subject, points, grade };
    });

    // Sort by points descending and take top 3
    subjectDetails.sort((a, b) => b.points - a.points);
    subjectDetails = subjectDetails.slice(0, 3);

    let essentialCount = 0;
    let essentialWeight = 0;
    let relevantWeight = 0;
    let desirableWeight = 0;

    subjectDetails.forEach(item => {
        const isEssential = (courseReq.essentialSubjects || []).some(req => matchSubject(item.subject, req));
        const isRequired = (courseReq.requiredSubjects || []).some(req => matchSubject(item.subject, req));

        let multiplier = 1; // Default desirable

        if (isEssential && essentialCount < 2) {
            multiplier = 3;
            essentialCount++;
        } else if (isEssential) {
            multiplier = 2; // Demote extra essential to relevant
        } else if (isRequired) {
            multiplier = 2;
        }

        const weighted = item.points * multiplier;

        if (multiplier === 3) essentialWeight += weighted;
        else if (multiplier === 2) relevantWeight += weighted;
        else desirableWeight += weighted;
    });

    total += essentialWeight + relevantWeight + desirableWeight;

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

// Helper function to build intelligent weight breakdown
function buildWeightBreakdown(data, principalSubjects, principalGrades, recommendations) {
    const weights = {
        oLevel: data.oLevelWeight || 0,
        genderBonus: data.gender === 'female' ? 1.5 : 0,
        subsidiaryPoints: data.subsidiaryResult === '1' ? 1 : 0,
        principalSubjects: [],
        essentialTotal: 0,
        relevantTotal: 0,
        desirableTotal: 0,
        total: 0
    };

    let essentialTotal = 0;
    let relevantTotal = 0;
    let desirableTotal = 0;

    if (principalSubjects.length === 0) {
        weights.total = Number(
            (weights.oLevel + weights.genderBonus + weights.subsidiaryPoints).toFixed(1)
        );
        return weights;
    }

    // Reference essentials and required from top matching course (or fallback)
    let referenceEssentials = [];
    let referenceRequired = [];
    if (recommendations.length > 0) {
        referenceEssentials = recommendations[0].essentialSubjects || [];
        referenceRequired = recommendations[0].requiredSubjects || [];
    } else {
        const allEss = new Set();
        const allReq = new Set();
        Object.values(universitiesData).forEach(uni => {
            Object.values(uni.courseRequirements || {}).forEach(req => {
                (req.essentialSubjects || []).forEach(es => allEss.add(es.toLowerCase().trim()));
                (req.requiredSubjects || []).forEach(rs => allReq.add(rs.toLowerCase().trim()));
            });
        });
        referenceEssentials = Array.from(allEss);
        referenceRequired = Array.from(allReq);
    }

    // Prepare subjects with points for prioritization, limit to top 3
    let subjectDetails = principalSubjects.map((subject, i) => {
        const grade = principalGrades[i];
        const points = gradePoints[grade] || 0;
        return { subject, grade, points };
    });

    // Sort by points descending and take top 3
    subjectDetails.sort((a, b) => b.points - a.points);
    subjectDetails = subjectDetails.slice(0, 3);

    // Assign multipliers: max 2 essentials
    let essentialCount = 0;

    subjectDetails.forEach((item) => {
        const subject = item.subject;
        const grade = item.grade;
        const points = item.points;

        const isTrueEssential = referenceEssentials.some(es => matchSubject(subject, es));
        const isRequired = referenceRequired.some(rs => matchSubject(subject, rs));

        let multiplier = 1; // Default desirable
        let category = 'Desirable';
        let note = 'Desirable subject';

        if (isTrueEssential && essentialCount < 2) {
            multiplier = 3;
            category = 'Essential';
            note = 'Essential for top matching courses';
            essentialCount++;
        } else if (isTrueEssential) {
            multiplier = 2; // Demote extra essential to relevant
            category = 'Relevant';
            note = 'Demoted essential (max 2 allowed)';
        } else if (isRequired) {
            multiplier = 2;
            category = 'Relevant';
            note = 'Relevant subject';
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
        else if (multiplier === 2) relevantTotal += weighted;
        else desirableTotal += weighted;
    });

    weights.essentialTotal = essentialTotal;
    weights.relevantTotal = relevantTotal;
    weights.desirableTotal = desirableTotal;

    weights.total = Number(
        (weights.oLevel + weights.genderBonus + weights.subsidiaryPoints + essentialTotal + relevantTotal + desirableTotal).toFixed(1)
    );

    return weights;
}

/* ============================   API ENDPOINT - submit-subjects ============================ */

app.post('/api/submit-subjects', (req, res) => {
    try {
        const rawData = req.body;

        // Required fields
        if (!rawData.gender || !rawData.level) {
            return res.status(400).json({
                success: false,
                message: "Gender and education level are required"
            });
        }

        // Normalize input
        const data = {
            gender: (rawData.gender || '').toLowerCase().trim(),
            level: (rawData.level || '').trim(),
            oLevelWeight: parseFloat(rawData.oLevelWeight) || 0,
            subsidiaryResult: rawData.subsidiaryResult,
            university: (rawData.university || '').trim()
        };

        // Validate O-Level weight
        if (isNaN(data.oLevelWeight) || data.oLevelWeight < 0 || data.oLevelWeight > 3) {
            return res.status(400).json({
                success: false,
                message: "O-Level weight must be a number between 0 and 3 (calculated from best 8 subjects: D1/D2=0.3, C3–C6=0.2, P7/P8=0.1)"
            });
        }

        // Collect principal subjects & grades
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

        // Get all eligible courses
        let recommendations = getEligibleCourses(data, principalSubjects, principalGrades);

        // University filter
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

        // Build weight breakdown
        const weights = buildWeightBreakdown(data, principalSubjects, principalGrades, recommendations);

        // Final response
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
                subsidiaryPoints: weights.subsidiaryPoints,
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