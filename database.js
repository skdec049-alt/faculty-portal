const { Sequelize, DataTypes } = require('sequelize');

let sequelize;

// ==========================================================
// --- 1. DYNAMIC DATABASE CONNECTION INITIALIZATION ---
// ==========================================================
if (process.env.DATABASE_URL) {
    // If running on cloud/Render, connect securely to Supabase (PostgreSQL)
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Required for hosted services like Render
            }
        },
        pool: {
            max: 5,                  
            min: 0,                  
            acquire: 30000,          
            idle: 10000              
        }
    });
} else {
    // UPDATED: Changed from local SQLite file fallback to local PostgreSQL database server
    sequelize = new Sequelize('faculty_db', 'postgres', '8961041249', {
        host: 'localhost',
        dialect: 'postgres',
        port: 5432,
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
}

// ==========================================================
// --- 2. DEFINE THE FACULTY TABLE ---
// ==========================================================
const Faculty = sequelize.define('Faculty', {
    fullname: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    college: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Techno India Group Jharkhand"
    },
    department: {
        type: DataTypes.STRING,
        allowNull: false
    },
    designation: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Faculty"
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    score: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    }
});

// ==========================================================
// --- 3. DEFINE THE COURSE TABLE ---
// ==========================================================
const Course = sequelize.define('Course', {
    courseName: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    courseCode: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        unique: true 
    },
    credits: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    }
});

// ==========================================================
// --- 4. DEFINE THE SUBMISSION TABLE ---
// ==========================================================
const Submission = sequelize.define('Submission', {
    title: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    category: { 
        type: DataTypes.STRING 
    },
    points: { 
        type: DataTypes.INTEGER 
    },
    details: { 
        type: DataTypes.TEXT 
    }, 
    date: { 
        type: DataTypes.DATE, 
        defaultValue: Sequelize.NOW 
    }
});

// ==========================================================
// --- 5. SET UP RELATIONSHIPS ---
// ==========================================================
Faculty.hasMany(Course);
Course.belongsTo(Faculty);

Faculty.hasMany(Submission);
Submission.belongsTo(Faculty);

// ==========================================================
// --- 6. CONSOLIDATED EXPORT ---
// ==========================================================
module.exports = { 
    sequelize, 
    Faculty, 
    Course, 
    Submission 
};