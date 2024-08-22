import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { GoogleGenerativeAI } from '@google/generative-ai';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [isValidKey, setIsValidKey] = useState(null); // null 表示未驗證，true 表示有效，false 表示無效
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('geminiApiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      validateApiKey(storedApiKey);
    }
  }, []);

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('geminiApiKey', key);
    validateApiKey(key);
  };

  const validateApiKey = async (key) => {
    if (!key) {
      setIsValidKey(false);
      return;
    }

    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const chatSession = model.startChat({
        generationConfig: {
          maxOutputTokens: 10,
        },
        history: [],
      });

      await chatSession.sendMessage('測試');
      setIsValidKey(true);
    } catch (error) {
      console.error('API Key 驗證失敗', error);
      setIsValidKey(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const formattedData = jsonData.map((row) => ({
        name: row[0],
        keywords: row[1],
        comment: '',
      }));

      setStudents(formattedData);
    };

    reader.readAsArrayBuffer(file);
  };

  const generateComments = async () => {
    if (!apiKey || !isValidKey) {
      alert('請輸入有效的 API Key');
      return;
    }

    setIsGenerating(true);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `你是一位年資非常深的國小班導，你對學生非常理解，現在你需要在學期末根據每位學生的特質寫出一些正向剪短的評語，以下是一些參考示範\n\n範例輸入1：\n[\"王小明\", \"聰明，協調性佳，體育不錯\"]\n\n範例輸出1：\n小明是個聰明的孩子，學習領悟力高。在體育方面表現佳，協調性很好。\n\n\n範例輸入2：\n[\"陳小美\", \"心思細膩，語文能力佳，有潔癖\"]\n\n範例輸出2：\n小美很愛乾淨，自己的座位和作業都能保持整潔乾淨，很棒!在語文方面表現很出色，尤其作文方面，更能展現出細膩的特質。\n\n注意不要加入任何顏文字或表情符號，並運用繁體中文以及台灣用語書寫，並且最少要有兩句話`,
    });

    for (let i = currentStudentIndex; i < students.length; i++) {
      let success = false;
      while (!success) {
        try {
          const comment = await generateComment(model, students[i].name, students[i].keywords);
          updateStudentComment(i, comment);
          success = true;
          setCurrentStudentIndex(i + 1);
        } catch (error) {
          console.error(`生成 ${students[i].name} 的評語失敗，正在重試...`, error);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    setIsGenerating(false);
  };

  const generateComment = async (model, name, keywords) => {
    const chatSession = model.startChat({
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      },
      history: [],
    });

    const response = await chatSession.sendMessage(`["${name}", "${keywords}"]`);
    return response.response.text();
  };

  const updateStudentComment = (index, comment) => {
    setStudents((prevStudents) => {
      const newStudents = [...prevStudents];
      newStudents[index].comment = comment;
      return newStudents;
    });
  };

  const handleFileDownload = () => {
    const worksheet = XLSX.utils.json_to_sheet(students);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comments');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });

    saveAs(data, 'output.xlsx');
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>學期評語生成器</h1>
      <div className={styles.apiKeyContainer}>
        <input
          type="password"
          placeholder="輸入您的 API Key"
          value={apiKey}
          onChange={handleApiKeyChange}
          disabled={isGenerating}
          className={styles.input}
        />
        {isValidKey !== null && (
          <span className={`${styles.inputStatus} ${isValidKey ? styles.success : styles.error}`}>
            {isValidKey ? '✅' : '❌'}
          </span>
        )}
      </div>
      <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" disabled={!isValidKey || isGenerating} className={styles.uploadButton} />
      {students.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>學生姓名</th>
                <th className={styles.th}>關鍵詞</th>
                <th className={styles.th}>評語</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={index}>
                  <td className={styles.td}>{student.name}</td>
                  <td className={styles.td}>{student.keywords}</td>
                  <td className={styles.td}>{student.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.buttonGroup}>
            <button onClick={generateComments} disabled={isGenerating} className={styles.button}>
              {isGenerating ? '生成中...' : '生成評語'}
            </button>
            <button onClick={handleFileDownload} disabled={isGenerating} className={styles.button}>
              下載結果
            </button>
          </div>
        </>
      )}
    </div>
  );
}
