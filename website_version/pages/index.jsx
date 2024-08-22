import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaw, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import styles from '../styles/Home.module.css';
import '@fortawesome/fontawesome-svg-core/styles.css';

Modal.setAppElement('#__next');

export default function Home() {
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [isValidKey, setIsValidKey] = useState(null); // null 表示未驗證，true 表示有效，false 表示無效
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const copyrightYear = currentYear === 2024 ? '2024' : `2024 – ${currentYear}`;

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

  const openModal = () => {
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>學期評語生成器</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta name="description" content="自動生成學生學期評語的工具，簡單方便，適合教師使用。" />
        <meta name="keywords" content="學期評語生成, 學生評語, 教師工具, AI 評語生成" />
      </Head>

      {/* 右上角的按鈕 */}
      <button className={styles.helpButton} onClick={openModal}>
        <FontAwesomeIcon icon={faInfoCircle} /> 使用教學
      </button>
      
      {/* 教學彈出視窗 */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="使用教學"
        className={styles.modal}
        overlayClassName={styles.overlay}
      >
        <h2>使用教學</h2>
        <button onClick={closeModal} className={styles.closeButton}>X</button>
        <div className={styles.modalContent}>
          <h3>1. 建立 API Key</h3>
          <p>
            先到 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a> 建立 API Key (如下圖)，接著將 API Key 複製然後貼到 <a href="https://ai-comments.moon-jam.me" target="_blank" rel="noopener noreferrer">網頁</a> 的框框中，並確認出現 ✅ 圖示，代表 API Key 設定成功。
          </p>
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-1.png" alt="Step 1" className={styles.image} />
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-2.png" alt="Step 2" className={styles.image} />
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-3.png" alt="Step 3" className={styles.image} />
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-4.png" alt="Step 4" className={styles.image} />
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-5.png" alt="Step 5" className={styles.image} />

          <h3>2. 創建 Excel 檔</h3>
          <p>
            創建一個 Excel 檔，在 A 欄輸入學生的名字，B 欄輸入學生的幾個特質，類似如下的格式，可以參考 <a href="https://github.com/moon-jam/AI_Gen_Semester_Comments_Tool/raw/main/sample.xlsx" target="_blank" rel="noopener noreferrer">sample.xlsx</a>。
          </p>
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/sample_excel.png" alt="Sample Excel" className={styles.image} />

          <h3>3. 上傳檔案並生成評語</h3>
          <p>
            點擊網頁中的 <span className={styles.highlight}>選擇檔案</span> (<span className={styles.highlight}>Choose File</span>)，選擇剛剛創建的 Excel 檔，然後點擊下方的 <span className={styles.highlight}>生成評語</span>，生成完後點擊 <span className={styles.highlight}>下載結果</span>，就完成了！
          </p>
          <img src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/process.png" alt="Full Process" className={styles.image} />
        </div>
      </Modal>

      <h1 className={styles.title}>學期評語生成器</h1>
      <div className={styles.apiKeyContainer}>
        <input
          type="password"
          placeholder="輸入您的 Gemini API Key"
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
      <footer className={styles.footer}>
        <div className={styles.copyright}>
          © {copyrightYear}
          <span className={styles.withLove}> <FontAwesomeIcon icon={faPaw} /> </span>
          <span className={styles.author} itemProp="copyrightHolder">
            <a href="https://github.com/moon-jam" target="_blank" rel="noopener noreferrer">Moon Jam</a>
          </span>
        </div>
        <div className={styles.projectInfo}>
          This project is open-sourced under the MIT license. Visit the project at <a href="https://github.com/moon-jam/AI_Gen_Semester_Comments_Tool" target="_blank" rel="noopener noreferrer">Here</a>.
        </div>
      </footer>
    </div>
  );
}

/*
TODO (bug) 第一次生成完之後如果要再一次生成，或是要生成其他檔案，需要重新整理
TODO 應該要讓使用者可以手動修改，增加欄位
TODO 應該要讓使用者可以選擇要生成的模型
TODO 讓使用者在不喜歡的生成結果上按下重新生成
TODO Prompt 還不夠好，隨機性也不夠高，很容易出現 ＸＸ 是個 ＯＯ 的孩子類似的語句
*/