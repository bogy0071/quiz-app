const { ipcRenderer } = require('electron');

let currentMode = 'practice';
let currentQuestionIndex = 0;
let shuffledQuestions = [];
let questions = [];
let correctAnswersCount = 0;
let totalQuestions = 0;
let selectedFilePath = '';

// Function to start quiz
function startQuiz(mode) {
  currentMode = mode;
  const numQuestions = parseInt(document.getElementById("num-questions").value);
  const timeLimit = parseInt(document.getElementById("time-limit").value) * 60;

  if (questions.length === 0) {
    alert("No questions available. Please upload a JSON file.");
    return;
  }

  shuffledQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, numQuestions);
  currentQuestionIndex = 0;
  correctAnswersCount = 0;
  totalQuestions = shuffledQuestions.length;

  document.getElementById('quiz-container').innerHTML = '';
  document.getElementById('timer').classList.toggle('hidden', mode !== 'test');

  if (mode === 'test') startTimer(timeLimit);
  showQuestion();
}

// Function to show questions
function showQuestion() {
  const container = document.getElementById('quiz-container');
  const q = shuffledQuestions[currentQuestionIndex];

  container.innerHTML = '';

  const questionElem = document.createElement('p');
  questionElem.textContent = q.question;
  container.appendChild(questionElem);

  q.options.forEach((option, index) => {
    const optionWrapper = document.createElement('div');
    optionWrapper.className = 'option-wrapper';
    
    const optionInput = document.createElement('input');
    optionInput.type = 'radio';
    optionInput.name = 'option';
    optionInput.value = index;
    
    const optionLabel = document.createElement('label');
    optionLabel.textContent = option;
    optionLabel.className = 'option-label';

    optionWrapper.appendChild(optionInput);
    optionWrapper.appendChild(optionLabel);
    container.appendChild(optionWrapper);
  });

  const nextButton = document.createElement('button');
  nextButton.textContent = 'Next Question';
  nextButton.id = `next-question-btn-${currentQuestionIndex}`;
  container.appendChild(nextButton);

  nextButton.addEventListener('click', submitAnswer);
}

// Function to move to the next question
function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < shuffledQuestions.length) {
    showQuestion();
  } else {
    endQuiz();
  }

  document.getElementById('feedback').innerHTML = '';
  document.getElementById('feedback').style.display = 'none';
}

// Function to submit answer
function submitAnswer() {
  const selected = document.querySelector('input[name="option"]:checked');
  const feedback = document.getElementById('feedback');
  const q = shuffledQuestions[currentQuestionIndex];

  if (!selected) {
    alert("Please select an option!");
    return;
  }

  const selectedIndex = parseInt(selected.value);
  const isCorrect = selectedIndex === q.answer;

  if (isCorrect) {
    correctAnswersCount++;
  }

  if (currentMode === 'practice') {
    feedback.innerHTML = `
      <p><strong>${isCorrect ? "Correct!" : "Incorrect."}</strong></p>
      <p><em>Explanation:</em> ${q.explanation}</p>
    `;
    feedback.style.display = 'block';
    const nextButton = document.querySelector(`#next-question-btn-${currentQuestionIndex}`);
    nextButton.removeEventListener('click', submitAnswer);
    nextButton.addEventListener('click', nextQuestion);
  } else {
    nextQuestion();
  }
}

// Function to start timer
function startTimer(durationInSeconds) {
  const endTime = Date.now() + durationInSeconds * 1000;

  function updateTimer() {
    const currentTime = Date.now();
    const remainingTime = Math.max(0, endTime - currentTime);
    const mins = Math.floor(remainingTime / 60000);
    const secs = Math.floor((remainingTime % 60000) / 1000);
    document.getElementById("time").textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    if (remainingTime > 0) {
      requestAnimationFrame(updateTimer);
    } else {
      alert("Time's up!");
      endQuiz();
    }
  }

  updateTimer();
}

// Function to end quiz
function endQuiz() {
  const percentCorrect = (correctAnswersCount / totalQuestions) * 100;
  document.getElementById('quiz-container').innerHTML = `
    <p>Quiz complete!</p>
    <p>You got ${percentCorrect}% of the questions correct.</p>
  `;
  document.getElementById('timer').classList.add('hidden');
  document.getElementById('feedback').style.display = 'none';
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("upload-json").addEventListener("change", handleFileImport);
  loadTopics();
});

// Function to handle file import
function handleFileImport(event) {
  const file = event.target.files[0];
  console.log('Selected file:', file);

  if (!file) {
    alert('No file selected for import.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const fileContent = e.target.result;
    console.log('File content loaded:', fileContent);

    try {
      const importedQuestions = JSON.parse(fileContent);

      const isValid = importedQuestions.every(q =>
        q.question && Array.isArray(q.options) &&
        typeof q.answer === 'number' && q.explanation
      );

      if (!isValid) throw new Error("Invalid format");

      questions = importedQuestions;
      alert(`Imported ${questions.length} questions.`);
    } catch (err) {
      alert("Failed to parse file. Make sure it's a valid JSON file.");
      console.error('Error parsing file content:', err);
    }
  };

  reader.onerror = function () {
    alert('Failed to read the file.');
    console.error('Error reading file:', reader.error);
  };

  reader.readAsText(file);
}

// Function to open topic window
function openTopicWindow() {
  console.log('Attempting to open topic window...');
  if (!selectedFilePath) {
    alert("Please select a file before importing questions.");
    return;
  }
  ipcRenderer.send('open-topic-window', selectedFilePath);
}

ipcRenderer.on('process-file', async (event, topic, filePath) => {
  console.log('Processing file:', filePath);
  try {
    const response = await fetch(`file://${filePath}`);
    const fileContent = await response.text();
    parseFileContent(fileContent, topic);
  } catch (err) {
    alert("Failed to read file. Make sure it's a valid JSON file.");
    console.error('Error reading file:', err);
  }
});

// Function to parse file content
async function parseFileContent(fileContent, topic) {
  try {
    console.log('Parsing file content:', fileContent);
    const importedQuestions = JSON.parse(fileContent);

    const isValid = importedQuestions.every(q =>
      q.question && Array.isArray(q.options) &&
      typeof q.answer === 'number' && q.explanation
    );

    if (!isValid) throw new Error("Invalid format");

    questions = importedQuestions;
    alert(`Imported ${questions.length} questions.`);
    saveQuestionsToDatabase(questions, topic);
  } catch (err) {
    alert("Failed to parse file. Make sure it's a valid JSON file.");
    console.error('Error parsing file content:', err);
  }
}

// Function to save questions to database
function saveQuestionsToDatabase(questions, topic) {
  fetch('http://localhost:3000/add-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ topic, questions })
  })
  .then(response => response.text())
  .then(data => {
    alert(data);
    loadTopics();
  })
  .catch(error => console.error('Error saving questions to database:', error));
}

// Function to delete questions
function deleteQuestions() {
  const topic = document.getElementById('select-topic').value;
  if (!topic) {
    alert("Please select a topic to delete.");
    return;
  }

  fetch(`http://localhost:3000/delete-questions/${topic}`, {
    method: 'DELETE'
  })
  .then(response => response.text())
  .then(data => {
    alert(data);
    loadTopics();
  })
  .catch(error => console.error('Error deleting questions:', error));
}

// Function to load topics
function loadTopics() {
  fetch('http://localhost:3000/get-topics')
    .then(response => response.json())
    .then(data => {
      const select = document.getElementById('select-topic');
      select.innerHTML = '';
      data.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        select.appendChild(option);
      });
    })
    .catch(error => console.error('Error loading topics:', error));
}

// Function to load questions
function loadQuestions() {
  const topic = document.getElementById('select-topic').value;
  fetch(`http://localhost:3000/get-questions/${topic}`)
    .then(response => response.json())
    .then(data => {
      questions = data.map(q => ({
        question: q.question,
        options: JSON.parse(q.options),
        answer: q.answer,
        explanation: q.explanation
      }));
      alert(`Loaded ${questions.length} questions for topic: ${topic}`);
    })
    .catch(error => console.error('Error loading questions:', error));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("upload-json").addEventListener("change", handleFileImport);
  loadTopics();
});