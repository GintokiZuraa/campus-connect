const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to PostgreSQL:', err.stack);
    } else {
        console.log('✅ Connected to PostgreSQL');
        release();
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const createTableQuery = `
    CREATE TABLE IF NOT EXISTS user_locations (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        origin_city TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        display_address TEXT,
        instagram TEXT,
        about_me TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`;

pool.query(createTableQuery).catch(err => console.error('Table creation error:', err));

const UNIVERSITY = {
    name: process.env.UNIVERSITY_NAME || 'Politeknik Negeri Cilacap',
    lat: parseFloat(process.env.UNIVERSITY_LAT) || -7.718063,
    lng: parseFloat(process.env.UNIVERSITY_LNG) || 109.019134
};

app.get('/api/locations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM user_locations ORDER BY created_at DESC');
        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
            university: UNIVERSITY
        });
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/locations', async (req, res) => {
    const { name, origin_city, latitude, longitude, display_address, user_id, instagram, about_me } = req.body;

    try {
        const check = await pool.query('SELECT id FROM user_locations WHERE user_id = $1', [user_id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Anda sudah memiliki lokasi. Gunakan edit untuk mengubah.' 
            });
        }

        const result = await pool.query(
            `INSERT INTO user_locations 
             (user_id, name, origin_city, latitude, longitude, display_address, instagram, about_me) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [user_id, name, origin_city, latitude, longitude, display_address, instagram || null, about_me || null]
        );

        res.status(201).json({
            success: true,
            message: 'Location added successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/locations/:id', async (req, res) => {
    const { name, origin_city, latitude, longitude, display_address, instagram, about_me } = req.body;
    const id = req.params.id;

    try {
        const result = await pool.query(
            `UPDATE user_locations 
             SET name = $1, origin_city = $2, latitude = $3, longitude = $4, 
                 display_address = $5, instagram = $6, about_me = $7, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $8 RETURNING *`,
            [name, origin_city, latitude, longitude, display_address, instagram || null, about_me || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/locations/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const getResult = await pool.query('SELECT * FROM user_locations WHERE id = $1', [id]);
        if (getResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        await pool.query('DELETE FROM user_locations WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Location deleted',
            data: getResult.rows[0]
        });
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const countResult = await pool.query('SELECT COUNT(*) as total FROM user_locations');
        const cityResult = await pool.query(`
            SELECT origin_city, COUNT(*) as count 
            FROM user_locations 
            GROUP BY origin_city 
            ORDER BY count DESC 
            LIMIT 5
        `);

        res.json({
            success: true,
            data: {
                total_users: parseInt(countResult.rows[0].total),
                top_cities: cityResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📍 University: ${UNIVERSITY.name}`);
});