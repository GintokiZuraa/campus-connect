const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./campus_connect.db');

db.run(`
    CREATE TABLE IF NOT EXISTS user_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        origin_city TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        display_address TEXT,
        instagram TEXT,
        about_me TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

const UNIVERSITY = {
    name: 'Politeknik Negeri Cilacap',
    lat: -7.718063,
    lng: 109.019134
};

app.get('/api/locations', (req, res) => {
    db.all('SELECT * FROM user_locations ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
        }
        res.json({
            success: true,
            count: rows.length,
            data: rows,
            university: UNIVERSITY
        });
    });
});

app.post('/api/locations', (req, res) => {
    const { name, origin_city, latitude, longitude, display_address, user_id, instagram, about_me } = req.body;
    
    db.get('SELECT id FROM user_locations WHERE user_id = ?', [user_id], (err, row) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
        }
        
        if (row) {
            res.status(400).json({ 
                success: false, 
                error: 'Anda sudah memiliki lokasi. Gunakan edit untuk mengubah.' 
            });
            return;
        }
        
        db.run(
            `INSERT INTO user_locations 
             (user_id, name, origin_city, latitude, longitude, display_address, instagram, about_me) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, name, origin_city, latitude, longitude, display_address, instagram || null, about_me || null],
            function(err) {
                if (err) {
                    res.status(500).json({ success: false, error: err.message });
                    return;
                }
                
                db.get('SELECT * FROM user_locations WHERE id = ?', [this.lastID], (err, row) => {
                    res.status(201).json({
                        success: true,
                        message: 'Location added successfully',
                        data: row
                    });
                });
            }
        );
    });
});

app.put('/api/locations/:id', (req, res) => {
    const { name, origin_city, latitude, longitude, display_address, instagram, about_me } = req.body;
    const id = req.params.id;
    
    db.run(
        `UPDATE user_locations 
         SET name = ?, origin_city = ?, latitude = ?, longitude = ?, 
             display_address = ?, instagram = ?, about_me = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [name, origin_city, latitude, longitude, display_address, instagram || null, about_me || null, id],
        function(err) {
            if (err) {
                res.status(500).json({ success: false, error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ success: false, error: 'Location not found' });
                return;
            }
            
            db.get('SELECT * FROM user_locations WHERE id = ?', [id], (err, row) => {
                res.json({
                    success: true,
                    message: 'Location updated successfully',
                    data: row
                });
            });
        }
    );
});

// DELETE /api/locations/:id
app.delete('/api/locations/:id', (req, res) => {
    db.get('SELECT * FROM user_locations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ success: false, error: 'Location not found' });
            return;
        }
        
        db.run('DELETE FROM user_locations WHERE id = ?', [req.params.id], (err) => {
            if (err) {
                res.status(500).json({ success: false, error: err.message });
                return;
            }
            res.json({ success: true, message: 'Location deleted', data: row });
        });
    });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM user_locations', (err, countRow) => {
        if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
        }
        
        db.all(`
            SELECT origin_city, COUNT(*) as count 
            FROM user_locations 
            GROUP BY origin_city 
            ORDER BY count DESC 
            LIMIT 5
        `, (err, cityRows) => {
            res.json({
                success: true,
                data: {
                    total_users: countRow.total,
                    top_cities: cityRows || []
                }
            });
        });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Using SQLite database: campus_connect.db`);
    console.log(`📍 University: ${UNIVERSITY.name}`);
});