const express = require('express');
const cors = require('cors');
const path = require('path'); 
const { sequelize, Faculty, Submission } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Index.html'));
});

// --- 1. SIGN UP ROUTE ---
app.post('/api/signup', async (req, res) => {
    try {
        const { fullname, email, college, department, designation, password } = req.body;
        
        const newFaculty = await Faculty.create({
            fullname,
            email,
            college,       
            department,
            designation,   
            password
        });
        
        return res.status(201).json({ message: "Success", user: newFaculty });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// --- 2. LOGIN ROUTE ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const faculty = await Faculty.findOne({ where: { email } });

        if (!faculty || faculty.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ 
            message: "Login successful!", 
            user: { 
                id: faculty.id, 
                fullname: faculty.fullname, 
                college: faculty.college,             
                department: faculty.department,
                designation: faculty.designation,     
                score: faculty.score
            } 
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

// --- 3. SUBMIT ACTIVITY ROUTE (UPDATED FOR ABSOLUTE SCORE CALCULATION) ---
app.post('/api/submit-activity', async (req, res) => {
    try {
        const { facultyId, category, title, details, points } = req.body;
        
        const faculty = await Faculty.findByPk(facultyId);
        if (!faculty) return res.status(404).json({ message: "Faculty record not found" });

        // 1. Create submission log
        await Submission.create({
            title: title || "Untitled Academic Work",
            category: category || "General Activity",
            points: parseInt(points) || 0,
            details: details || "No additional metrics specified.", 
            FacultyId: facultyId
        });

        // 2. Direct Column Aggregation: Re-calculate complete sum directly from the database
        const freshCalculatedTotal = await Submission.sum('points', {
            where: { FacultyId: facultyId }
        });

        // 3. Persist absolute sum directly into core score property matrix
        faculty.score = parseInt(freshCalculatedTotal || 0);
        await faculty.save();

        console.log(`✅ Activity logged safely for ${faculty.fullname}. Live aggregated score recalculated to: ${faculty.score}`);
        res.json({ success: true, newScore: faculty.score });
    } catch (error) {
        console.error("Activity Submission Endpoint Error:", error);
        res.status(500).json({ message: "Error tracking structured entry", error: error.message });
    }
});

// --- 4. GET REPORTS (HISTORY) ---
app.get('/api/reports/:facultyId', async (req, res) => {
    try {
        const reports = await Submission.findAll({ 
            where: { FacultyId: req.params.facultyId },
            order: [['createdAt', 'DESC']] 
        });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ message: "Error fetching reports" });
    }
});

// --- 5. GET ALL FACULTY (FOR DASHBOARD) ---
app.get('/api/faculty', async (req, res) => {
    try {
        const facultyMembers = await Faculty.findAll({
            attributes: ['id', 'fullname', 'college', 'department', 'designation', 'score'] 
        });
        res.json(facultyMembers);
    } catch (error) {
        res.status(500).json({ message: "Error fetching data", error: error.message });
    }
});

// --- 6. DATABASE CLEANUP ROUTE ---
app.get('/api/clean-database', async (req, res) => {
    try {
        const legacySubmissions = await Submission.findAll({
            where: {
                category: ['General', 'General Activity', 'Uncategorized Activities']
            }
        });

        const affectedFacultyIds = [...new Set(legacySubmissions.map(s => s.FacultyId))];

        const deletedCount = await Submission.destroy({
            where: {
                category: ['General', 'General Activity', 'Uncategorized Activities']
            }
        });
        
        for (const facultyId of affectedFacultyIds) {
            const remainingActivities = await Submission.findAll({ where: { FacultyId: facultyId } });
            const freshScore = remainingActivities.reduce((sum, item) => sum + parseInt(item.points || 0), 0);
            
            await Faculty.update({ score: freshScore }, { where: { id: facultyId } });
        }
        
        res.json({ 
            success: true, 
            message: `Cleaned up ${deletedCount} legacy records and successfully synchronized all affected profile scores!` 
        });
    } catch (error) {
        res.status(500).json({ message: "Cleanup failed", error: error.message });
    }
});

// --- 7. DELETE AN ACTIVITY ENTRY ---
app.delete('/api/reports/:id', async (req, res) => {
    try {
        const submission = await Submission.findByPk(req.params.id);
        if (!submission) return res.status(404).json({ message: "Entry not found" });

        const facultyId = submission.FacultyId;
        await submission.destroy();

        const remainingSubmissions = await Submission.findAll({ where: { FacultyId: facultyId } });
        const recalculateScore = remainingSubmissions.reduce((sum, item) => sum + parseInt(item.points || 0), 0);

        const faculty = await Faculty.findByPk(facultyId);
        let updatedScore = 0;
        
        if (faculty) {
            faculty.score = recalculateScore < 0 ? 0 : recalculateScore; 
            await faculty.save();
            updatedScore = faculty.score;
        }

        res.json({ 
            success: true, 
            message: "Entry deleted successfully!", 
            newScore: updatedScore 
        });
    } catch (error) {
        res.status(500).json({ message: "Server error during deletion", error: error.message });
    }
});

// --- 8. EDIT AN ACTIVITY ENTRY ---
app.put('/api/reports/:id', async (req, res) => {
    try {
        const { title, details } = req.body;
        const submission = await Submission.findByPk(req.params.id);
        if (!submission) return res.status(404).json({ message: "Entry not found" });

        submission.title = title;
        submission.details = details;
        await submission.save();

        res.json({ success: true, message: "Entry updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error during modification", error: error.message });
    }
});

// --- 9. GET ALL SUBMISSIONS FOR ADMIN AUDITING ---
app.get('/api/admin/reports/all', async (req, res) => {
    try {
        const allSubmissions = await Submission.findAll({
            include: [{
                model: Faculty,
                attributes: ['fullname', 'department', 'college', 'id']
            }],
            order: [['createdAt', 'DESC']]
        });

        const structuredLogs = allSubmissions.map(item => {
            return {
                id: item.id,
                title: item.title,
                category: item.category,
                points: item.points,
                details: item.details,
                createdAt: item.createdAt,
                facultyId: item.FacultyId,
                facultyName: item.Faculty ? item.Faculty.fullname : "Unknown Profile",
                department: item.Faculty ? item.Faculty.department : "N/A",
                college: item.Faculty ? item.Faculty.college : "N/A"
            };
        });

        res.json(structuredLogs);
    } catch (error) {
        console.error("Admin Master Log Retrieval Error:", error);
        res.status(500).json({ message: "Database link processing exception", error: error.message });
    }
});

// --- START SERVER WITH DYNAMIC PORT ---
const PORT = process.env.PORT || 3000;

// UPDATED: Changed back to { alter: true } so data persists cleanly across future builds without wiping tables.
sequelize.sync({ alter: true }).then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log("📂 PostgreSQL Database Synced and Ready.");
    });
}).catch(err => {
    console.error("❌ Failed to sync database:", err);
});