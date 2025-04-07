const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const bodyParser = require('body-parser');
const fs = require('fs');

let mainWindow;
let topicWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

const createTopicWindow = (filePath) => {
  topicWindow = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  topicWindow.loadFile(path.join(__dirname, 'topic.html'));
  topicWindow.webContents.on('did-finish-load', () => {
    topicWindow.webContents.send('file-path', filePath);
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Express server setup
const serverApp = express();
serverApp.use(bodyParser.json());
serverApp.use(express.static(path.join(__dirname, 'public')));

// Determine the correct path to the database file
const getDatabasePath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'quiz.db');
  } else {
    return path.join(__dirname, 'quiz.db');
  }
};

const dbPath = getDatabasePath();

// Ensure the database file exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '');
}

const db = new Database(dbPath);

db.exec("CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY, topic TEXT, question TEXT, options TEXT, answer INTEGER, explanation TEXT)");

serverApp.post('/add-questions', (req, res) => {
  const questions = req.body.questions;
  const topic = req.body.topic;

  const stmt = db.prepare("INSERT INTO questions (topic, question, options, answer, explanation) VALUES (?, ?, ?, ?, ?)");

  const insert = db.transaction((questions) => {
    for (const q of questions) {
      stmt.run(topic, q.question, JSON.stringify(q.options), q.answer, q.explanation);
    }
  });

  insert(questions);
  res.send("Questions added successfully.");
});

serverApp.delete('/delete-questions/:topic', (req, res) => {
  const topic = req.params.topic;
  const stmt = db.prepare("DELETE FROM questions WHERE topic = ?");
  const info = stmt.run(topic);

  if (info.changes > 0) {
    res.send(`Questions for topic '${topic}' deleted successfully.`);
  } else {
    res.status(404).send(`No questions found for topic '${topic}'.`);
  }
});

serverApp.get('/get-topics', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT topic FROM questions").all();
  res.json(rows.map(row => row.topic));
});

serverApp.get('/get-questions/:topic', (req, res) => {
  const topic = req.params.topic;
  const rows = db.prepare("SELECT * FROM questions WHERE topic = ?").all(topic);
  res.json(rows);
});

serverApp.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});

ipcMain.on('import-file', (event, filePath) => {
  createTopicWindow(filePath);
});

ipcMain.on('submit-topic', (event, topic, filePath) => {
  mainWindow.webContents.send('process-file', topic, filePath);
});