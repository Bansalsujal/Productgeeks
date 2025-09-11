import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      full_name TEXT NOT NULL,
      career_stage TEXT,
      industry TEXT,
      onboarded BOOLEAN DEFAULT FALSE,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Questions table
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      type_label TEXT NOT NULL,
      difficulty TEXT DEFAULT 'intermediate',
      metadata TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Interview sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS interview_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      conversation TEXT,
      duration_minutes REAL,
      composite_score REAL,
      dimension_scores TEXT,
      feedback TEXT,
      completed BOOLEAN DEFAULT FALSE,
      date TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (question_id) REFERENCES questions (id)
    )
  `);

  // User stats table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_stats (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      total_solved INTEGER DEFAULT 0,
      avg_score_design REAL,
      avg_score_improvement REAL,
      avg_score_rca REAL,
      avg_score_guesstimate REAL,
      last_activity_date TEXT,
      activity_calendar TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Insert sample questions
  const sampleQuestions = [
    {
      id: uuidv4(),
      question_text: "Design a mobile app for busy parents to manage their family's schedule and activities.",
      type_label: "design",
      difficulty: "intermediate"
    },
    {
      id: uuidv4(),
      question_text: "How would you improve the user experience of online grocery shopping?",
      type_label: "improvement",
      difficulty: "intermediate"
    },
    {
      id: uuidv4(),
      question_text: "Instagram Stories engagement has dropped by 15% over the past month. What could be causing this and how would you investigate?",
      type_label: "rca",
      difficulty: "intermediate"
    },
    {
      id: uuidv4(),
      question_text: "Estimate the number of pizza slices consumed in New York City on a typical Friday night.",
      type_label: "guesstimate",
      difficulty: "intermediate"
    },
    {
      id: uuidv4(),
      question_text: "Design a product to help remote workers stay connected with their colleagues.",
      type_label: "design",
      difficulty: "beginner"
    },
    {
      id: uuidv4(),
      question_text: "How would you improve the checkout process for an e-commerce website?",
      type_label: "improvement",
      difficulty: "beginner"
    }
  ];

  // Check if questions already exist
  db.get("SELECT COUNT(*) as count FROM questions", (err, row) => {
    if (err) {
      console.error('Error checking questions:', err);
      return;
    }
    
    if (row.count === 0) {
      const stmt = db.prepare("INSERT INTO questions (id, question_text, type_label, difficulty) VALUES (?, ?, ?, ?)");
      sampleQuestions.forEach(question => {
        stmt.run(question.id, question.question_text, question.type_label, question.difficulty);
      });
      stmt.finalize();
      console.log('Sample questions inserted');
    }
  });
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.run(
      "INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)",
      [userId, email, hashedPassword, full_name],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'Email already exists' });
          }
          return res.status(500).json({ message: 'Error creating user' });
        }

        const token = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'your-secret-key');
        
        res.json({
          token,
          user: { id: userId, email, full_name, onboarded: false }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }

      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'your-secret-key');
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          career_stage: user.career_stage,
          industry: user.industry,
          onboarded: user.onboarded
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get("SELECT * FROM users WHERE id = ?", [req.user.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      career_stage: user.career_stage,
      industry: user.industry,
      onboarded: user.onboarded
    });
  });
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { career_stage, industry, onboarded } = req.body;
  
  db.run(
    "UPDATE users SET career_stage = ?, industry = ?, onboarded = ? WHERE id = ?",
    [career_stage, industry, onboarded, req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating profile' });
      }

      db.get("SELECT * FROM users WHERE id = ?", [req.user.userId], (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Server error' });
        }

        res.json({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          career_stage: user.career_stage,
          industry: user.industry,
          onboarded: user.onboarded
        });
      });
    }
  );
});

// Questions routes
app.get('/api/questions', (req, res) => {
  const { type } = req.query;
  let query = "SELECT * FROM questions";
  let params = [];

  if (type) {
    query += " WHERE type_label = ?";
    params.push(type);
  }

  db.all(query, params, (err, questions) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching questions' });
    }
    res.json(questions);
  });
});

// Sessions routes
app.post('/api/sessions', authenticateToken, (req, res) => {
  const { question_id, question_type, conversation, completed } = req.body;
  const sessionId = uuidv4();

  db.run(
    "INSERT INTO interview_sessions (id, user_id, question_id, question_type, conversation, completed) VALUES (?, ?, ?, ?, ?, ?)",
    [sessionId, req.user.userId, question_id, question_type, JSON.stringify(conversation || []), completed || false],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating session' });
      }

      res.json({ id: sessionId });
    }
  );
});

app.put('/api/sessions/:id', authenticateToken, (req, res) => {
  const { conversation, duration_minutes, composite_score, dimension_scores, feedback, completed, date } = req.body;
  
  db.run(
    `UPDATE interview_sessions SET 
     conversation = ?, duration_minutes = ?, composite_score = ?, 
     dimension_scores = ?, feedback = ?, completed = ?, date = ?
     WHERE id = ? AND user_id = ?`,
    [
      JSON.stringify(conversation),
      duration_minutes,
      composite_score,
      JSON.stringify(dimension_scores),
      JSON.stringify(feedback),
      completed,
      date,
      req.params.id,
      req.user.userId
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating session' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Update user stats if session is completed
      if (completed) {
        updateUserStats(req.user.userId);
      }

      res.json({ message: 'Session updated successfully' });
    }
  );
});

app.get('/api/sessions', authenticateToken, (req, res) => {
  db.all(
    "SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY created_date DESC",
    [req.user.userId],
    (err, sessions) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching sessions' });
      }

      const parsedSessions = sessions.map(session => ({
        ...session,
        conversation: session.conversation ? JSON.parse(session.conversation) : [],
        dimension_scores: session.dimension_scores ? JSON.parse(session.dimension_scores) : {},
        feedback: session.feedback ? JSON.parse(session.feedback) : {}
      }));

      res.json(parsedSessions);
    }
  );
});

app.get('/api/sessions/:id', authenticateToken, (req, res) => {
  db.get(
    "SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.userId],
    (err, session) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching session' });
      }

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      const parsedSession = {
        ...session,
        conversation: session.conversation ? JSON.parse(session.conversation) : [],
        dimension_scores: session.dimension_scores ? JSON.parse(session.dimension_scores) : {},
        feedback: session.feedback ? JSON.parse(session.feedback) : {}
      };

      res.json(parsedSession);
    }
  );
});

// User stats routes
app.get('/api/stats', authenticateToken, (req, res) => {
  db.get(
    "SELECT * FROM user_stats WHERE user_id = ?",
    [req.user.userId],
    (err, stats) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching stats' });
      }

      if (!stats) {
        // Create default stats if none exist
        const defaultStats = {
          id: uuidv4(),
          user_id: req.user.userId,
          current_streak: 0,
          longest_streak: 0,
          total_solved: 0
        };

        db.run(
          "INSERT INTO user_stats (id, user_id, current_streak, longest_streak, total_solved) VALUES (?, ?, ?, ?, ?)",
          [defaultStats.id, defaultStats.user_id, defaultStats.current_streak, defaultStats.longest_streak, defaultStats.total_solved],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error creating stats' });
            }
            res.json(defaultStats);
          }
        );
      } else {
        res.json(stats);
      }
    }
  );
});

// AI integration
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
  try {
    const { prompt, schema } = req.body;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    let response;
    
    if (schema) {
      // Structured response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content;
      res.json(JSON.parse(content));
    } else {
      // Regular text response
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      
      res.json(response.choices[0].message.content);
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ message: 'Error generating AI response' });
  }
});

// Helper function to update user stats
function updateUserStats(userId) {
  // Get all completed sessions for this user
  db.all(
    "SELECT * FROM interview_sessions WHERE user_id = ? AND completed = 1",
    [userId],
    (err, sessions) => {
      if (err) {
        console.error('Error fetching sessions for stats update:', err);
        return;
      }

      // Calculate averages for each question type
      const avgScores = {};
      ['design', 'improvement', 'rca', 'guesstimate'].forEach(type => {
        const typeSessions = sessions.filter(s => s.question_type === type && s.composite_score);
        if (typeSessions.length > 0) {
          const totalScore = typeSessions.reduce((sum, s) => sum + s.composite_score, 0);
          avgScores[`avg_score_${type}`] = totalScore / typeSessions.length;
        }
      });

      // Calculate streaks
      const today = new Date().toISOString().split('T')[0];
      const activityDates = new Set();
      
      sessions.forEach(session => {
        const dateToUse = session.date || session.created_date.split(' ')[0];
        if (dateToUse) {
          activityDates.add(dateToUse);
        }
      });

      // Calculate current streak
      let currentStreak = 0;
      let checkDate = new Date();
      
      if (!activityDates.has(today)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      while (true) {
        const checkDateStr = checkDate.toISOString().split('T')[0];
        if (activityDates.has(checkDateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Calculate longest streak
      const sortedDates = Array.from(activityDates).sort();
      let longestStreak = 0;
      let tempStreak = 1;
      
      if (sortedDates.length > 0) {
        longestStreak = 1;
        
        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const diffMs = currDate.getTime() - prevDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      }

      // Update or create user stats
      const statsUpdate = {
        current_streak: currentStreak,
        longest_streak: longestStreak,
        total_solved: sessions.length,
        last_activity_date: today,
        ...avgScores
      };

      db.get("SELECT * FROM user_stats WHERE user_id = ?", [userId], (err, existingStats) => {
        if (err) {
          console.error('Error checking existing stats:', err);
          return;
        }

        if (existingStats) {
          // Update existing stats
          const updateFields = Object.keys(statsUpdate).map(key => `${key} = ?`).join(', ');
          const updateValues = Object.values(statsUpdate);
          updateValues.push(userId);

          db.run(
            `UPDATE user_stats SET ${updateFields} WHERE user_id = ?`,
            updateValues,
            (err) => {
              if (err) {
                console.error('Error updating user stats:', err);
              }
            }
          );
        } else {
          // Create new stats
          const statsId = uuidv4();
          db.run(
            `INSERT INTO user_stats (id, user_id, current_streak, longest_streak, total_solved, last_activity_date, 
             avg_score_design, avg_score_improvement, avg_score_rca, avg_score_guesstimate) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              statsId, userId, statsUpdate.current_streak, statsUpdate.longest_streak,
              statsUpdate.total_solved, statsUpdate.last_activity_date,
              statsUpdate.avg_score_design, statsUpdate.avg_score_improvement,
              statsUpdate.avg_score_rca, statsUpdate.avg_score_guesstimate
            ],
            (err) => {
              if (err) {
                console.error('Error creating user stats:', err);
              }
            }
          );
        }
      });
    }
  );
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});