const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

const db = new sqlite3.Database('./quiz.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run("CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, topic TEXT, question TEXT, options TEXT, answer INTEGER, explanation TEXT)", [], (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Questions table created or already exists.');
      }
    });
  }
});

app.post('/add-questions', (req, res) => {
  const questions = req.body.questions;
  const topic = req.body.topic;

  const stmt = db.prepare("INSERT INTO questions (topic, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?)");

  questions.forEach(q => {
    stmt.run(topic, q.question, JSON.stringify(q.options), q.answer, q.explanation);
  });

  stmt.finalize();
  res.send("Questions added successfully.");
});

app.get('/get-topics', (req, res) => {
  db.all("SELECT DISTINCT topic FROM questions", (err, rows) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.json(rows.map(row => row.topic));
    }
  });
});

app.get('/get-questions/:topic', (req, res) => {
  const topic = req.params.topic;
  db.all("SELECT * FROM questions WHERE topic = ?", [topic], (err, rows) => {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.json(rows);
    }
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});