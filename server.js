const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Grade to points mapping for A-Level
const gradePoints = {
    'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1, 'O': 0
};

// Subject mapping for better matching
const subjectMapping = {
    'math': ['mathematics', 'math', 'maths'],
    'physics': ['physics'],
    'chemistry': ['chemistry'],
    'biology': ['biology'],
    'economics': ['economics'],
    'geography': ['geography'],
    'history': ['history'],
    'english': ['english', 'literature'],
    'fine art': ['fine art', 'art', 'drawing'],
    'technical drawing': ['technical drawing', 'td'],
    'entrepreneurship': ['entrepreneurship'],
    'agriculture': ['agriculture'],
    'computer': ['computer', 'ict', 'information technology'],
    'french': ['french'],
    'german': ['german'],
    'luganda': ['luganda'],
    'religious education': ['religious education', 're'],
    'music': ['music'],
    'physical education': ['physical education', 'pe']
};

// Complete course requirements from both PDFs
const courseRequirements = {
  // ==================== FACULTY OF SPECIAL NEEDS & REHABILITATION ====================
    "ACD": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "ACE": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "CBD": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "CBE": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "CSD": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "CSE": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },

    // ==================== FACULTY OF EDUCATION ====================
    "AED": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "AEE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "ADD": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["fine art"], 
        essentialSubjects: ["fine art"],
        programType: "Degree" 
    },
    "ADE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["fine art"], 
        essentialSubjects: ["fine art"],
        programType: "Degree" 
    },
    "BDD": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science", "commercial"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "BDE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science", "commercial"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "BGD": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "BGE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["arts", "science"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "ESB": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry", "biology"], 
        essentialSubjects: ["chemistry", "biology"],
        programType: "Degree" 
    },
    "ESE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "ESP": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "physics", "chemistry"], 
        essentialSubjects: ["mathematics", "physics", "chemistry"],
        programType: "Degree" 
    },
    "PPD": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "PPE": { 
        faculty: "Education", 
        duration: "3 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Degree" 
    },

    // ==================== SCHOOL OF MANAGEMENT & ENTREPRENEURSHIP ====================
    "BSD": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "BSE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "BBK": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "BKE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "AFD": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "AFE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "ASD": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "ASE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "PLD": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "entrepreneurship", "economics"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "PLE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "entrepreneurship", "economics"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "MSD": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "MSE": { 
        faculty: "Management & Entrepreneurship", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "entrepreneurship"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },

    // ==================== FACULTY OF ENGINEERING ====================
    "VTD": { 
        faculty: "Engineering", 
        duration: "3 Years", 
        requiredSubjects: ["physical science", "vocational studies"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Degree" 
    },
    "ECD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "ECE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "EMD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "EME": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "ETD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "ETE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "BEL": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["physics", "mathematics"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Degree" 
    },
    "BET": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["physics", "mathematics"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Degree" 
    },
    "BIO": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["physics", "mathematics"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Degree" 
    },
    "BIE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["physics", "mathematics"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Degree" 
    },
    "EBD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "EBE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "EED": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "EEE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "APD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "APE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "IED": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "IEE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "SLD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "geography"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "SLE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "geography"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "BLD": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "BLE": { 
        faculty: "Engineering", 
        duration: "4 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "ARD": { 
        faculty: "Engineering", 
        duration: "5 Years", 
        requiredSubjects: ["mathematics", "physics", "fine art", "technical drawing"], 
        essentialSubjects: ["mathematics", "physics", "fine art"],
        programType: "Degree" 
    },

    // ==================== FACULTY OF SCIENCE ====================
    "GPD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry", "mathematics", "physics"], 
        essentialSubjects: ["chemistry", "mathematics", "physics"],
        programType: "Degree" 
    },
    "GPE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry", "mathematics", "physics"], 
        essentialSubjects: ["chemistry", "mathematics", "physics"],
        programType: "Degree" 
    },
    "STD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics"], 
        essentialSubjects: ["mathematics"],
        programType: "Degree" 
    },
    "MCD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["physics", "chemistry"], 
        essentialSubjects: ["physics", "chemistry"],
        programType: "Degree" 
    },
    "PTD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["physics"], 
        essentialSubjects: ["physics"],
        programType: "Degree" 
    },
    "PTE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["physics"], 
        essentialSubjects: ["physics"],
        programType: "Degree" 
    },
    "CTD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry"], 
        essentialSubjects: ["chemistry"],
        programType: "Degree" 
    },
    "CTE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry"], 
        essentialSubjects: ["chemistry"],
        programType: "Degree" 
    },
    "BTD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["biology"], 
        essentialSubjects: ["biology"],
        programType: "Degree" 
    },
    "BTE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["biology"], 
        essentialSubjects: ["biology"],
        programType: "Degree" 
    },
    "ITD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "ITE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "physics", "economics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Degree" 
    },
    "FPD": { 
        faculty: "Science", 
        duration: "4 Years", 
        requiredSubjects: ["chemistry", "biology"], 
        essentialSubjects: ["chemistry", "biology"],
        programType: "Degree" 
    },
    "FPE": { 
        faculty: "Science", 
        duration: "4 Years", 
        requiredSubjects: ["chemistry", "biology"], 
        essentialSubjects: ["chemistry", "biology"],
        programType: "Degree" 
    },
    "TCD": { 
        faculty: "Science", 
        duration: "4 Years", 
        requiredSubjects: ["chemistry", "physics", "mathematics", "clothing and textile"], 
        essentialSubjects: ["chemistry", "physics"],
        programType: "Degree" 
    },
    "LMD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["biology", "economics", "geography", "mathematics"], 
        essentialSubjects: ["biology", "mathematics"],
        programType: "Degree" 
    },
    "SAD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["biology", "economics", "geography", "mathematics"], 
        essentialSubjects: ["biology", "mathematics"],
        programType: "Degree" 
    },
    "SEE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["biology", "economics", "geography", "mathematics"], 
        essentialSubjects: ["biology", "mathematics"],
        programType: "Degree" 
    },
    "BMD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry", "biology", "physics", "mathematics", "agriculture", "geography", "economics", "technical drawing"], 
        essentialSubjects: ["chemistry", "biology", "physics"],
        programType: "Degree" 
    },
    "BME": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["chemistry", "biology", "physics", "mathematics", "agriculture", "geography", "economics", "technical drawing"], 
        essentialSubjects: ["chemistry", "biology", "physics"],
        programType: "Degree" 
    },
    "CHD": { 
        faculty: "Science", 
        duration: "4 Years", 
        requiredSubjects: ["chemistry", "physics", "mathematics"], 
        essentialSubjects: ["chemistry", "physics", "mathematics"],
        programType: "Degree" 
    },
    "CHE": { 
        faculty: "Science", 
        duration: "4 Years", 
        requiredSubjects: ["chemistry", "physics", "mathematics"], 
        essentialSubjects: ["chemistry", "physics", "mathematics"],
        programType: "Degree" 
    },
    "ISD": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["economics", "entrepreneurship", "geography", "mathematics"], 
        essentialSubjects: ["economics", "mathematics"],
        programType: "Degree" 
    },
    "ISE": { 
        faculty: "Science", 
        duration: "3 Years", 
        requiredSubjects: ["economics", "entrepreneurship", "geography", "mathematics"], 
        essentialSubjects: ["economics", "mathematics"],
        programType: "Degree" 
    },

    // ==================== FACULTY OF ARTS AND SOCIAL SCIENCES ====================
    "EKD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "EKE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "SSD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "SSE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "BRD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "geography", "biology"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "BRE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["mathematics", "economics", "geography", "biology"], 
        essentialSubjects: ["mathematics", "economics"],
        programType: "Degree" 
    },
    "BPD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "BPE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "SWD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "SWE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["economics"], 
        essentialSubjects: ["economics"],
        programType: "Degree" 
    },
    "LID": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "LIE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "PHD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "PHE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "AHD": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "AHE": { 
        faculty: "Arts & Social Sciences", 
        duration: "3 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },

    // ==================== FACULTY OF VOCATIONAL STUDIES ====================
    "AGD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["agriculture"], 
        essentialSubjects: ["agriculture"],
        programType: "Degree" 
    },
    "AGE": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["agriculture"], 
        essentialSubjects: ["agriculture"],
        programType: "Degree" 
    },
    "VHD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["foods and nutrition", "chemistry", "biology", "agriculture", "clothing and textiles"], 
        essentialSubjects: ["foods and nutrition", "chemistry", "biology"],
        programType: "Degree" 
    },
    "VAD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["fine art"], 
        essentialSubjects: ["fine art"],
        programType: "Degree" 
    },
    "AID": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["fine art"], 
        essentialSubjects: ["fine art"],
        programType: "Degree" 
    },
    "HND": { 
        faculty: "Vocational Studies", 
        duration: "4 Years", 
        requiredSubjects: ["foods and nutrition", "chemistry", "biology", "agriculture"], 
        essentialSubjects: ["foods and nutrition", "chemistry", "biology"],
        programType: "Degree" 
    },
    "HID": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["science", "arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "HIE": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["science", "arts"], 
        essentialSubjects: [],
        programType: "Degree" 
    },
    "TAD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["art", "home economics"], 
        essentialSubjects: ["art", "home economics"],
        programType: "Degree" 
    },
    "CGD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["art", "computer studies"], 
        essentialSubjects: ["art", "computer studies"],
        programType: "Degree" 
    },
    "BIL": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["art", "technical drawing"], 
        essentialSubjects: ["art", "technical drawing"],
        programType: "Degree" 
    },
    "FCD": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["art", "home economics"], 
        essentialSubjects: ["art", "home economics"],
        programType: "Degree" 
    },
    "FCE": { 
        faculty: "Vocational Studies", 
        duration: "3 Years", 
        requiredSubjects: ["art", "home economics"], 
        essentialSubjects: ["art", "home economics"],
        programType: "Degree" 
    },

    // ==================== DIPLOMA PROGRAMS ====================
    "CBR": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "2 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Diploma" 
    },
    "DBE": { 
        faculty: "Engineering", 
        duration: "2 Years", 
        requiredSubjects: ["physics", "mathematics", "chemistry", "biology"], 
        essentialSubjects: ["physics", "mathematics"],
        programType: "Diploma" 
    },
    "DFP": { 
        faculty: "Science", 
        duration: "2 Years", 
        requiredSubjects: ["chemistry", "biology", "agriculture", "foods and nutrition"], 
        essentialSubjects: ["chemistry", "biology"],
        programType: "Diploma" 
    },
    "DHC": { 
        faculty: "Vocational Studies", 
        duration: "2 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Diploma" 
    },
    "DID": { 
        faculty: "Vocational Studies", 
        duration: "2 Years", 
        requiredSubjects: ["art"], 
        essentialSubjects: ["art"],
        programType: "Diploma" 
    },
    "DRA": { 
        faculty: "Engineering", 
        duration: "2 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Diploma" 
    },
    "DWE": { 
        faculty: "Engineering", 
        duration: "2 Years", 
        requiredSubjects: ["mathematics", "physics"], 
        essentialSubjects: ["mathematics", "physics"],
        programType: "Diploma" 
    },
    "FAD": { 
        faculty: "Vocational Studies", 
        duration: "2 Years", 
        requiredSubjects: ["art"], 
        essentialSubjects: ["art"],
        programType: "Diploma" 
    },
    "MBR": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "2 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Diploma" 
    },
    "MTE": { 
        faculty: "Arts & Social Sciences", 
        duration: "2 Years", 
        requiredSubjects: ["arts"], 
        essentialSubjects: [],
        programType: "Diploma" 
    },
    "SLI": { 
        faculty: "Special Needs & Rehabilitation", 
        duration: "2 Years", 
        requiredSubjects: ["any"], 
        essentialSubjects: [],
        programType: "Diploma" 
    },
    "STB": { 
        faculty: "Science", 
        duration: "2 Years", 
        requiredSubjects: ["biology"], 
        essentialSubjects: ["biology"],
        programType: "Diploma" 
    },
    "STC": { 
        faculty: "Science", 
        duration: "2 Years", 
        requiredSubjects: ["chemistry"], 
        essentialSubjects: ["chemistry"],
        programType: "Diploma" 
    },
    "STP": { 
        faculty: "Science", 
        duration: "2 Years", 
        requiredSubjects: ["physics"], 
        essentialSubjects: ["physics"],
        programType: "Diploma" 
    },
    "TEX": { 
        faculty: "Vocational Studies", 
        duration: "2 Years", 
        requiredSubjects: ["art"], 
        essentialSubjects: ["art"],
        programType: "Diploma" 
    }
};
// Complete cut-off points from PDF
const cutOffPoints = {
    "ACD": 16.1, "ACE": 17.2, "ADD": 22.6, "ADE": 14.2, "ADS": 13.4,
    "AED": 30.8, "AEE": 15.0, "AFD": 29.8, "AFE": 22.4, "AGD": 22.4,
    "AGE": 16.8, "AHD": 18.0, "AHE": 16.4, "AID": 34.9, "APD": 43.4,
    "APE": 40.2, "ARD": 46.7, "ASD": 17.4, "BBD": 32.3, "BBE": 23.4,
    "BBK": 27.0, "BDD": 16.2, "BDE": 16.5, "BEE": 15.0, "BEK": 30.1,
    "BEL": 47.4, "BET": 44.7, "BFD": 28.2, "BFE": 16.3, "BGD": 16.3,
    "BGE": 20.0, "BIE": 39.8, "BIL": 34.5, "BIO": 43.4, "BKE": 19.3,
    "BLD": 35.8, "BLE": 36.0, "BMD": 32.4, "BME": 25.6, "BPD": 16.5,
    "BRD": 15.9, "BRE": 16.6, "BSD": 18.1, "BSE": 7.9, "BSW": 26.9,
    "BTD": 18.6, "BTE": 14.4, "CBD": 17.8, "CBE": 16.8, "CBR": 12.1,
    "CGD": 31.7, "CHD": 39.9, "CHE": 35.5, "CSD": 15.8, "CSE": 14.8,
    "CTD": 15.3, "DBE": 23.3, "DFP": 17.6, "DHC": 12.1, "DID": 18.9,
    "DRA": 19.1, "DWE": 23.8, "EBD": 37.5, "EBE": 35.1, "ECD": 48.9,
    "ECE": 46.9, "EED": 40.3, "EEE": 35.8, "EHD": 16.7, "EHE": 19.0,
    "EKD": 20.0, "EKE": 9.7, "EMD": 46.0, "EME": 44.3, "ESB": 35.4,
    "ESE": 28.8, "ESP": 34.1, "ETD": 43.5, "ETE": 40.0, "FAD": 11.7,
    "FCD": 25.3, "FCE": 15.7, "FPD": 31.5, "FPE": 24.9, "GID": 19.8,
    "GIE": 14.3, "GPD": 38.1, "GPE": 34.1, "HCD": 22.1, "HCE": 17.1,
    "HID": 14.6, "HIE": 15.3, "HND": 31.3, "HNE": 18.2, "HSD": 16.8,
    "HSE": 20.9, "IED": 41.5, "IEE": 38.0, "ISD": 27.5, "ISE": 27.7,
    "ITD": 33.7, "ITE": 27.4, "LID": 20.8, "LIE": 15.3, "LMD": 22.3,
    "MBR": 13.0, "MCD": 27.6, "MSD": 7.0, "MSE": 7.9, "MTE": 14.0,
    "PAD": 27.5, "PAE": 16.1, "PLD": 25.7, "PLE": 18.9, "PPD": 17.2,
    "PPE": 16.8, "PTD": 21.3, "PTE": 19.5, "SAD": 15.7, "SDD": 15.0,
    "SDE": 17.3, "SEE": 15.4, "SLD": 44.5, "SLE": 41.7, "SLI": 12.0,
    "SSD": 22.9, "SSE": 14.3, "STD": 29.4, "TAD": 20.5, "TCD": 18.3,
    "TEX": 14.3, "VHD": 21.6, "VTD": 22.8
};

// Course names mapping
const courseNames = {
    "ACD": "Bachelor of Adult and Community Education - KyU(Day)",
    "ACE": "Bachelor of Adult and Community Education - KyU(Evening)",
    "ADD": "Bachelor of Art and Design with Education - KyU (Day)",
    "ADE": "Bachelor of Art and Design with Education - KyU (Evening)",
    "AED": "Bachelor of Arts with Education - KyU (Day)",
    "AEE": "Bachelor of Arts with Education - KyU (Evening)",
    "AFD": "Bachelor of Science in Accounting and Finance - KyU (Day)",
    "AFE": "Bachelor of Science in Accounting and Finance - KyU (Evening)",
    "AGD": "Bachelor of Vocational Studies in Agriculture with Education- KyU (Day)",
    "AID": "Bachelor of Art and Industrial Design - KyU (Day)",
    "APD": "Bachelor of Engineering in Automotive and Power Engineering - KyU (Day)",
    "ARD": "Bachelor of Architecture - KyU (Day)",
    "ASD": "Bachelor of Administrative and Secretarial Science - KyU (Day)",
    "BBK": "Bachelor of Business Administration - KyU (Day)",
    "BKE": "Bachelor of Business Administration - KyU (Evening)",
    "BDD": "Bachelor of Development Studies - KyU (Day)",
    "BEK": "Bachelor of Economics and Statistics - KyU (Day)",
    "BEL": "Bachelor of Electrical Engineering - KyU (Day)",
    "BGD": "Bachelor of Guidance and Counselling - KyU (Day)",
    "BIO": "Bachelor of Mechatronics and Biomedical Engineering - KyU (Day)",
    "BLD": "Bachelor of Science in Land Economics - KyU (Day)",
    "BMD": "Bachelor of Environmental Science Technology and Management - KyU (Day)",
    "BSD": "Bachelor of Business Studies with Education - KyU (Day)",
    "BTD": "Bachelor of Science Technology - Biology - KyU (Day)",
    "CBD": "Bachelor of Community Based Rehabilitation - KyU (Day)",
    "CGD": "Bachelor of Computer Graphic Design - KyU (Evening)",
    "CHD": "Bachelor of Science in Chemical and Process Engineering - KyU (Day)",
    "CSD": "Bachelor of Community Development and Social Justice - KyU (Day)",
    "EBD": "Bachelor of Science in Building Economics - KyU (Day)",
    "ECD": "Bachelor of Engineering Civil and Building Engineering - KyU (Day)",
    "EED": "Bachelor of Engineering in Environmental Engineering and Management - KyU (Day)",
    "EKD": "Bachelor of Arts in Economics - KyU (Day)",
    "EMD": "Bachelor of Engineering in Mechanical and Manufacturing Engineering - KyU (Day)",
    "ESB": "Bachelor of Science with Education (Biological Sciences) - KyU (Day)",
    "ETD": "Bachelor of Engineering in Telecommunication Engineering - KyU (Day)",
    "FPD": "Bachelor of Food Processing Technology - KyU (Day)",
    "GPD": "Bachelor of Science in Oil and Gas Production - KyU (Day)",
    "HID": "Bachelor of Hotel and Institutional Catering- KyU (Day)",
    "HND": "Bachelor of Science in Human Nutrition and Dietetics - KyU (Day)",
    "IED": "Bachelor of Industrial Engineering and Management - KyU (Day)",
    "ISD": "Bachelor of Information Systems - KyU (Day)",
    "ITD": "Bachelor of Information Technology and Computing - KyU (Day)",
    "LID": "Bachelor of Library and Information Science - KyU (Day)",
    "MSD": "Bachelor of Management Science - KyU (Day)",
    "PAD": "Bachelor of Public Administration and Resource Governance - KyU (Day)",
    "PLD": "Bachelor of Procurement and Logistics Management - KyU (Day)",
    "PPD": "Bachelor of Pre-Primary Education (Day)",
    "PTD": "Bachelor of Science Technology Physics - KyU (Day)",
    "SAD": "Bachelor of Science in Sport and Exercise Instruction - KyU (Day)",
    "SLD": "Bachelor of Science in Surveying and Land Information Systems - KyU (Day)",
    "SSD": "Bachelor of Arts in Social Sciences - KyU (Day)",
    "STD": "Bachelor of Science in Statistics - KyU (Day)",
    "TAD": "Bachelor of Textile and Apparel Design - KyU (Day)",
    "VHD": "Bachelor of Vocational Studies in Home Economics with Education (Day)",
    "VTD": "Bachelor of Vocational Studies in Technological Studies with Education (Day)"
};

// Helper function to match subjects
function matchSubject(studentSubject, requiredSubject) {
    const studentSubj = studentSubject.toLowerCase().trim();
    const requiredSubj = requiredSubject.toLowerCase().trim();
    
    // Direct match
    if (studentSubj === requiredSubj) return true;
    
    // Check subject mapping
    for (const [key, variations] of Object.entries(subjectMapping)) {
        if (variations.includes(studentSubj) && variations.includes(requiredSubj)) {
            return true;
        }
    }
    
    // Partial match
    if (studentSubj.includes(requiredSubj) || requiredSubj.includes(studentSubj)) {
        return true;
    }
    
    return false;
}

// Calculate A-Level weight for a specific course
function calculateCourseWeight(courseCode, studentData, principalSubjects, principalGrades) {
    const courseReq = courseRequirements[courseCode];
    if (!courseReq) return 0;
    
    let totalWeight = 0;
    
    // Add O-Level weight
    totalWeight += parseFloat(studentData.oLevelWeight) || 0;
    
    // Add gender bonus for females
    if (studentData.gender === 'female') {
        totalWeight += 1.5;
    }
    
    // Calculate principal subjects weight with multipliers
    let essentialSubjectsWeight = 0;
    let otherSubjectsWeight = 0;
    
    principalSubjects.forEach((subject, index) => {
        const grade = principalGrades[index];
        const points = gradePoints[grade] || 0;
        
        // Check if this subject is essential for the course
        const isEssential = courseReq.essentialSubjects.some(reqSubject => 
            matchSubject(subject, reqSubject)
        );
        
        if (isEssential) {
            essentialSubjectsWeight += points * 3; // Essential subjects × 3
        } else {
            otherSubjectsWeight += points * 2; // Other principals × 2
        }
    });
    
    totalWeight += essentialSubjectsWeight + otherSubjectsWeight;
    
    // Add subsidiary subject (if passed)
    if (studentData.subsidiaryGrade === '1') {
        totalWeight += 1; // Subsidiary × 1
    }
    
    // Add General Paper (always 1 point if we assume pass)
    totalWeight += 1; // General Paper × 1
    
    return parseFloat(totalWeight.toFixed(1));
}

// Check if student meets subject requirements
function meetsSubjectRequirements(courseReq, principalSubjects) {
    if (!courseReq.requiredSubjects || courseReq.requiredSubjects.length === 0) return true;
    
    if (courseReq.requiredSubjects.includes("any")) return true;
    
    // For "arts" requirement, check if student has any arts subject
    if (courseReq.requiredSubjects.includes("arts")) {
        const artsSubjects = ['history', 'geography', 'english', 'literature', 'religious education', 'fine art', 'music'];
        return principalSubjects.some(subject => 
            artsSubjects.some(art => matchSubject(subject, art))
        );
    }
    
    // For specific subject requirements
    return courseReq.requiredSubjects.some(requiredSubject => 
        principalSubjects.some(studentSubject => 
            matchSubject(studentSubject, requiredSubject)
        )
    );
}

// Get eligible courses
function getEligibleCourses(studentData, principalSubjects, principalGrades) {
    const eligibleCourses = [];
    
    // Focus on Kyambogo University courses only
    const kyambogoCourses = Object.keys(courseRequirements).filter(code => 
        courseNames[code] && courseNames[code].includes('KyU')
    );
    
    for (const code of kyambogoCourses) {
        const requirements = courseRequirements[code];
        const cutOff = cutOffPoints[code];
        
        // Skip if no cut-off point
        if (!cutOff || cutOff === null) continue;
        
        // Check subject requirements
        if (!meetsSubjectRequirements(requirements, principalSubjects)) continue;
        
        // Calculate course-specific weight
        const courseWeight = calculateCourseWeight(code, studentData, principalSubjects, principalGrades);
        
        // Check if meets cut-off point
        if (courseWeight >= cutOff) {
            const matchScore = Math.min(100, Math.round((courseWeight / cutOff) * 100));
            
            eligibleCourses.push({
                code: code,
                name: courseNames[code],
                faculty: requirements.faculty,
                duration: requirements.duration,
                cutOff: cutOff,
                yourWeight: courseWeight,
                matchScore: matchScore,
                programType: requirements.programType,
                university: "Kyambogo University",
                essentialSubjects: requirements.essentialSubjects,
                requiredSubjects: requirements.requiredSubjects
            });
        }
    }
    
    // Sort by weight (descending)
    eligibleCourses.sort((a, b) => b.yourWeight - a.yourWeight);
    
    return eligibleCourses;
}

// Calculate detailed weight breakdown
function calculateWeightBreakdown(studentData, principalSubjects, principalGrades, courseCode = null) {
    const breakdown = {
        oLevel: parseFloat(studentData.oLevelWeight) || 0,
        genderBonus: studentData.gender === 'female' ? 1.5 : 0,
        principalSubjects: [],
        essentialSubjects: 0,
        otherSubjects: 0,
        subsidiary: studentData.subsidiaryGrade === '1' ? 1 : 0,
        generalPaper: 1,
        total: 0
    };
    
    // Calculate principal subjects breakdown
    principalSubjects.forEach((subject, index) => {
        const grade = principalGrades[index];
        const points = gradePoints[grade] || 0;
        
        let multiplier = 2; // Default for other subjects
        let category = 'other';
        
        // If course-specific, check if essential
        if (courseCode) {
            const courseReq = courseRequirements[courseCode];
            if (courseReq && courseReq.essentialSubjects.some(reqSubject => 
                matchSubject(subject, reqSubject))) {
                multiplier = 3;
                category = 'essential';
            }
        }
        
        const weightedPoints = points * multiplier;
        
        breakdown.principalSubjects.push({
            subject: subject,
            grade: grade,
            points: points,
            multiplier: multiplier,
            weightedPoints: weightedPoints,
            category: category
        });
        
        if (category === 'essential') {
            breakdown.essentialSubjects += weightedPoints;
        } else {
            breakdown.otherSubjects += weightedPoints;
        }
    });
    
    // Calculate total
    breakdown.total = breakdown.oLevel + breakdown.genderBonus + 
                     breakdown.essentialSubjects + breakdown.otherSubjects + 
                     breakdown.subsidiary + breakdown.generalPaper;
    
    return breakdown;
}

// API endpoint for course recommendations
app.post('/api/submit-subjects', (req, res) => {
    try {
        const data = req.body;
        
        console.log('Received data:', data);
        
        // Validate required fields
        if (!data.gender || !data.level) {
            return res.json({ 
                success: false, 
                message: 'Please fill all required fields including gender and education level' 
            });
        }
        
        if (data.level === 'A-Level') {
            if (!data.oLevelWeight || data.oLevelWeight === '') {
                return res.json({
                    success: false,
                    message: 'Please enter your O-Level weight for A-Level students'
                });
            }
            
            // Validate principal subjects
            let hasPrincipals = false;
            for (let i = 1; i <= 3; i++) {
                if (data[`principal${i}`] && data[`principalGrade${i}`]) {
                    hasPrincipals = true;
                    break;
                }
            }
            
            if (!hasPrincipals) {
                return res.json({
                    success: false,
                    message: 'Please enter at least one principal subject and grade'
                });
            }
        }
        
        // Validate O-Level weight
        if (data.oLevelWeight) {
            const weight = parseFloat(data.oLevelWeight);
            if (weight < 0 || weight > 3) {
                return res.json({
                    success: false,
                    message: 'O-Level weight must be between 0 and 3'
                });
            }
        }
        
        // Extract principal subjects and grades
        const principalSubjects = [];
        const principalGrades = [];
        
        if (data.level === 'A-Level') {
            for (let i = 1; i <= 3; i++) {
                const subject = data[`principal${i}`];
                const grade = data[`principalGrade${i}`];
                if (subject && grade) {
                    principalSubjects.push(subject);
                    principalGrades.push(grade.toUpperCase());
                }
            }
        }
        
        // Calculate weight breakdown
        const weightBreakdown = calculateWeightBreakdown(data, principalSubjects, principalGrades);
        
        // Get eligible courses
        const eligibleCourses = data.level === 'A-Level' ? 
            getEligibleCourses(data, principalSubjects, principalGrades) : [];
        
        console.log(`Found ${eligibleCourses.length} eligible courses`);
        
        res.json({
            success: true,
            recommendations: eligibleCourses.slice(0, 10), // Top 10 courses
            totalCourses: eligibleCourses.length,
            calculatedWeights: weightBreakdown,
            studentData: data,
            principalSubjects: principalSubjects,
            principalGrades: principalGrades
        });
        
    } catch (error) {
        console.error('Error processing request:', error);
        res.json({ 
            success: false, 
            message: 'Server error processing your request: ' + error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'NUVA Course Guidance System is running',
        timestamp: new Date().toISOString(),
        totalCourses: Object.keys(courseRequirements).length
    });
});

// Test endpoint
app.get('/api/test-calculation', (req, res) => {
    // Test case: Student with Physics (A), Math (B), Technical Drawing (A)
    const testData = {
        gender: 'male',
        level: 'A-Level',
        oLevelWeight: '2.3',
        subsidiaryGrade: '1'
    };
    
    const principalSubjects = ['Physics', 'Mathematics', 'Technical Drawing'];
    const principalGrades = ['A', 'B', 'A'];
    
    const breakdown = calculateWeightBreakdown(testData, principalSubjects, principalGrades);
    const courses = getEligibleCourses(testData, principalSubjects, principalGrades);
    
    res.json({
        testData: testData,
        subjects: principalSubjects,
        grades: principalGrades,
        weightBreakdown: breakdown,
        eligibleCourses: courses.length,
        sampleCourses: courses.slice(0, 3)
    });
});

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/course-input', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'course-input.html'));
});

app.get('/results', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'results.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NUVA Course Guidance System running on port ${PORT}`);
    console.log(`Access the system at: http://localhost:${PORT}`);
    console.log(`Total courses loaded: ${Object.keys(courseRequirements).length}`);
    console.log(`Test endpoint: http://localhost:${PORT}/api/test-calculation`);
});