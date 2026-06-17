import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { GoogleAnalytics } from '@next/third-parties/google';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { GoogleGenAI } from '@google/genai';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaw,
  faInfoCircle,
  faRedo,
  faEye,
  faEyeSlash,
  faGripVertical,
  faPlus,
  faTrash,
  faPause,
  faPlay,
  faKey,
  faFileArrowUp,
  faDownload,
  faUsers,
  faWandMagicSparkles,
  faLightbulb,
} from '@fortawesome/free-solid-svg-icons';
import Modal from 'react-modal';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import styles from '../styles/New.module.css';
import '@fortawesome/fontawesome-svg-core/styles.css';

import prompts from '../config/prompts';
import MODELS from '../config/models';

if (typeof window !== 'undefined') {
  Modal.setAppElement('#__next');
}

export default function NewPage() {
  // ======== 狀態管理 ========
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [isValidKey, setIsValidKey] = useState(null); // null 未驗證, true 有效, false 無效
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [commentLength, setCommentLength] = useState('short');
  const [showApiKey, setShowApiKey] = useState(false);
  const [focusedStudentIndex, setFocusedStudentIndex] = useState(null);

  const tableEndRef = useRef(null);
  const modelIndexRef = useRef(0); // 輪替模型索引

  const [commonTraits] = useState([
    '活潑外向',
    '心思細膩',
    '反應快',
    '樂於助人',
    '領導力佳',
    '語文能力強',
    '體育表現突出',
    '數理邏輯好',
    '藝術天份高',
    '協調性佳',
    '有潔癖',
  ]);

  const [customTraits, setCustomTraits] = useState([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [basePromptSelection, setBasePromptSelection] = useState('short');

  const currentYear = new Date().getFullYear();
  const copyrightYear = currentYear === 2024 ? '2024' : `2024 – ${currentYear}`;

  const isLocked = isGenerating && !isPaused; // 整批生成中（未暫停）→ 鎖定編輯
  // 尚未驗證金鑰，或正在生成中時，停用上傳、新增學生與評語設定等操作。
  const editLocked = !isValidKey || isLocked;

  // ======== 載入自訂特質與提示詞 ========
  useEffect(() => {
    const savedCustomTraits = JSON.parse(localStorage.getItem('customTraits')) || [];
    setCustomTraits(savedCustomTraits);

    const savedCommentLength = localStorage.getItem('commentLength') || 'short';
    setCommentLength(savedCommentLength);

    if (savedCommentLength === 'custom') {
      const savedCustomPrompt = localStorage.getItem('customPrompt') || prompts['short'];
      setCustomPrompt(savedCustomPrompt);
      setIsPromptExpanded(true);
    } else {
      setCustomPrompt('');
      setIsPromptExpanded(false);
    }
  }, []);

  // ======== API Key ========
  const toggleShowApiKey = () => setShowApiKey((prev) => !prev);
  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    validateApiKey(key);
  };
  const validateApiKey = async (key) => {
    if (!key) {
      setIsValidKey(false);
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // 用 models.list() 驗證金鑰：不消耗生成額度，也不依賴某個特定模型是否仍存在
      const pager = await ai.models.list();
      for await (const _model of pager) break; // 能成功取得任一模型即代表金鑰有效
      setIsValidKey(true);
    } catch (error) {
      console.error('API Key 驗證失敗', error);
      setIsValidKey(false);
    }
  };

  // ======== 上傳 / 新增學生 ========
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target.result;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const worksheet = workbook.worksheets[0];
      const newStudents = [];
      worksheet.eachRow((row) => {
        const rowValues = row.values;
        const name = rowValues[1] ? rowValues[1].toString() : '';
        const keywords = rowValues[2] ? rowValues[2].toString() : '';
        if (name || keywords) {
          newStudents.push({ name, keywords, comment: '' });
        }
      });
      setStudents(newStudents);
      setTimeout(scrollToBottom, 200);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // 允許重複選同一個檔案
  };
  const handleAddStudent = () => {
    setStudents((prev) => [...prev, { name: '', keywords: '', comment: '' }]);
    setTimeout(scrollToBottom, 200);
  };
  const scrollToBottom = () => {
    if (tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ======== 特質 ========
  const handleAddCustomTrait = () => {
    const trait = window.prompt('請輸入自訂的特質名稱：');
    if (trait && trait.trim()) {
      const next = [...customTraits, trait.trim()];
      setCustomTraits(next);
      localStorage.setItem('customTraits', JSON.stringify(next));
    }
  };
  const handleAddTraitToFocused = (trait) => {
    if (focusedStudentIndex === null) {
      alert('請先點選欲編輯的關鍵字欄位，才能插入特質。');
      return;
    }
    setStudents((prev) => {
      const next = [...prev];
      const oldKeywords = next[focusedStudentIndex].keywords || '';
      next[focusedStudentIndex].keywords = oldKeywords
        ? oldKeywords.trim() + '，' + trait
        : trait;
      return next;
    });
  };
  const handleDeleteCustomTrait = (traitToDelete) => {
    const next = customTraits.filter((t) => t !== traitToDelete);
    setCustomTraits(next);
    localStorage.setItem('customTraits', JSON.stringify(next));
  };

  // ======== 編輯 / 刪除 ========
  const handleEditStudentField = (index, field, value) => {
    setStudents((prev) => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  };
  const handleFocusKeywordField = (index) => setFocusedStudentIndex(index);
  const handleDeleteStudent = (index) => {
    if (!window.confirm('確定要刪除此學生嗎？')) return;
    setStudents((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  // ======== 生成評語流程 & 暫停繼續 ========
  const generateComments = async (resume = false) => {
    if (!apiKey || !isValidKey) {
      alert('請輸入有效的 API Key');
      return;
    }
    if (!resume) {
      setCurrentStudentIndex(0);
      setIsPaused(false);
      setIsGenerating(true);
    }

    const ai = new GoogleGenAI({ apiKey });
    const BATCH_SIZE = 5;
    const startIndex = resume ? currentStudentIndex : 0;

    for (let i = startIndex; i < students.length; i += BATCH_SIZE) {
      if (isPaused) {
        setCurrentStudentIndex(i);
        return;
      }
      const batch = students.slice(i, i + BATCH_SIZE).map((student, idx) => ({
        id: i + idx,
        name: student.name,
        keywords: student.keywords,
      }));
      if (batch.length === 0) break;

      let success = false;
      while (!success) {
        try {
          const results = await generateBatchComments(ai, batch);
          setStudents((prev) => {
            const next = [...prev];
            results.forEach((result) => {
              if (next[result.id]) next[result.id].comment = result.comment;
            });
            return next;
          });
          success = true;
          await new Promise((resolve) => setTimeout(resolve, 5000));
          setCurrentStudentIndex(i + BATCH_SIZE);
        } catch (error) {
          console.error(`批次生成 (Index ${i} ~ ${i + batch.length - 1}) 失敗，正在重試...`, error);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
        if (isPaused) return;
      }
    }

    setIsGenerating(false);
    setIsPaused(false);
  };

  const regenerateSingleComment = async (index) => {
    if (!apiKey || !isValidKey) {
      alert('請輸入有效的 API Key');
      return;
    }
    if (isGenerating && !isPaused) {
      alert('目前正在生成中，請暫停後再嘗試單獨重生。');
      return;
    }
    try {
      setIsGenerating(true);
      const ai = new GoogleGenAI({ apiKey });
      const batch = [{ id: index, name: students[index].name, keywords: students[index].keywords }];
      const results = await generateBatchComments(ai, batch);
      if (results && results.length > 0) {
        updateStudentComment(index, results[0].comment);
      }
    } catch (error) {
      console.error(`重新生成 ${students[index].name} 的評語失敗`, error);
      alert(`重新生成 ${students[index].name} 的評語失敗，請稍後再試`);
    } finally {
      setIsGenerating(false);
    }
  };

  const pauseOrResume = () => {
    if (isPaused) {
      setIsPaused(false);
      generateComments(true);
    } else {
      setIsPaused(true);
    }
  };

  const generateBatchComments = async (ai, batch) => {
    // 輪詢模型：每批換下一個，把用量分散到各模型的免費額度
    const modelName = MODELS[modelIndexRef.current % MODELS.length];
    modelIndexRef.current += 1;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(batch) }] }],
      config: {
        systemInstruction: { parts: [{ text: buildSystemPrompt(commentLength) }] },
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 1.2,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });
    const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    // 解析回應。偶爾（特別是 lite 模型）會多吐字元導致 JSON 無效，
    // 先嘗試擷取第一個 JSON 陣列；若仍失敗則丟出錯誤，
    // 讓外層重試並輪到下一個模型，避免把整批學生靜默留白。
    try {
      return JSON.parse(text);
    } catch (e) {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (_) { /* 落到下方丟錯 */ }
      }
      console.error('JSON Parse Error:', e, text);
      throw new Error('評語回應解析失敗，將以其他模型重試');
    }
  };

  const updateStudentComment = (index, comment) => {
    setStudents((prev) => {
      const next = [...prev];
      next[index].comment = comment;
      return next;
    });
  };

  const buildSystemPrompt = (length) => {
    if (length === 'custom') return customPrompt || prompts['short'];
    return prompts[length] || prompts['short'];
  };

  // ======== 下載結果 ========
  const handleFileDownload = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Comments');
    worksheet.columns = [
      { header: '編號', key: 'id', width: 10 },
      { header: '學生姓名', key: 'name', width: 20 },
      { header: '關鍵詞', key: 'keywords', width: 40 },
      { header: '評語', key: 'comment', width: 60 },
    ];
    students.forEach((student, idx) => {
      worksheet.addRow({
        id: idx + 1,
        name: student.name,
        keywords: student.keywords,
        comment: student.comment,
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), 'output.xlsx');
  };

  // ======== Modal ========
  const openModal = () => setModalIsOpen(true);
  const closeModal = () => setModalIsOpen(false);

  // ======== 拖曳排序 ========
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const next = Array.from(students);
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    setStudents(next);
  };

  // ======== 自訂提示詞 / 評語長度 ========
  const handleCustomPromptChange = (e) => {
    setCustomPrompt(e.target.value);
    localStorage.setItem('customPrompt', e.target.value);
  };
  const handleCommentLengthChange = (e) => {
    const newLength = e.target.value;
    setCommentLength(newLength);
    localStorage.setItem('commentLength', newLength);
    if (newLength === 'custom') {
      const initialPrompt = prompts[basePromptSelection] || prompts['short'];
      setCustomPrompt(initialPrompt);
      localStorage.setItem('customPrompt', initialPrompt);
      setIsPromptExpanded(true);
    } else {
      setCustomPrompt('');
      localStorage.removeItem('customPrompt');
      setIsPromptExpanded(false);
    }
  };
  const handleBasePromptSelection = (e) => {
    const selectedBase = e.target.value;
    setBasePromptSelection(selectedBase);
    if (commentLength === 'custom') {
      const newPrompt = prompts[selectedBase] || prompts['short'];
      setCustomPrompt(newPrompt);
      localStorage.setItem('customPrompt', newPrompt);
    }
  };
  const togglePromptExpansion = () => setIsPromptExpanded((prev) => !prev);

  const filledCount = students.filter((s) => s.comment && s.comment.trim()).length;

  return (
    <div className={styles.page}>
      <div className={styles.ambient} />
      <Head>
        <title>AI 學期評語生成器</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <meta
          name="description"
          content="AI 自動生成學生學期評語的工具，簡單方便，適合教師使用。"
        />
        <meta
          name="keywords"
          content="學期評語生成器, 學生評語, 教師工具, AI 評語生成, 期末評語生成器, 期末參考評語生成器"
        />
      </Head>

      <main className={styles.shell}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.brandMark}>
              <FontAwesomeIcon icon={faPaw} />
            </span>
            <h1 className={styles.headline}>AI 學期評語生成器</h1>
          </div>
          <button className={styles.helpBtn} onClick={openModal}>
            <FontAwesomeIcon icon={faInfoCircle} /> 使用教學
          </button>
        </div>

        {/* 1 · API 金鑰 */}
        <section className={`${styles.panel} ${styles.rise}`}>
          <div className={styles.panelHead}>
            <span className={styles.stepBadge}>1</span>
            <span className={styles.panelTitle}>
              <FontAwesomeIcon icon={faKey} />&nbsp; 輸入 Gemini API 金鑰
            </span>
            <span className={styles.panelHint}>
              還沒有金鑰？{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                到 Google AI Studio 建立
              </a>
            </span>
          </div>
          <div className={styles.apiRow}>
            <div className={styles.apiField}>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="貼上您的 Gemini API Key"
                value={apiKey}
                onChange={handleApiKeyChange}
                disabled={isLocked}
                className={styles.apiInput}
              />
              <button
                type="button"
                onClick={toggleShowApiKey}
                className={styles.eyeBtn}
                disabled={!apiKey}
                aria-label={showApiKey ? '隱藏金鑰' : '顯示金鑰'}
              >
                <FontAwesomeIcon icon={showApiKey ? faEyeSlash : faEye} />
              </button>
            </div>
            {isValidKey !== null && (
              <span className={`${styles.statusPill} ${isValidKey ? styles.statusOk : styles.statusBad}`}>
                <span className={styles.statusDot} />
                {isValidKey ? '金鑰有效' : '金鑰無效'}
              </span>
            )}
          </div>
        </section>

        {/* 2 · 評語設定 */}
        <section className={`${styles.panel} ${styles.rise}`}>
          <div className={styles.panelHead}>
            <span className={styles.stepBadge}>2</span>
            <span className={styles.panelTitle}>選擇評語風格</span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="commentLength">評語長度</label>
            <select
              id="commentLength"
              className={styles.select}
              value={commentLength}
              onChange={handleCommentLengthChange}
              disabled={editLocked}
            >
              <option value="short">短評 (2~3 句)</option>
              <option value="medium">中評 (4~5 句)</option>
              <option value="long">長評 (6~8 句)</option>
              <option value="custom">自訂</option>
            </select>
          </div>

          {commentLength === 'custom' && (
            <div className={styles.promptBox}>
              <div className={styles.promptRow}>
                <label className={styles.label} htmlFor="basePromptSelection">基底提示詞</label>
                <select
                  id="basePromptSelection"
                  className={styles.select}
                  value={basePromptSelection}
                  onChange={handleBasePromptSelection}
                  disabled={editLocked}
                >
                  <option value="short">短評 (2~3 句)</option>
                  <option value="medium">中評 (4~5 句)</option>
                  <option value="long">長評 (6~8 句)</option>
                </select>
              </div>
              <div className={styles.promptRow}>
                <label className={styles.label} htmlFor="customPrompt">自訂提示詞</label>
                <button
                  type="button"
                  onClick={togglePromptExpansion}
                  className={styles.toggleBtn}
                  disabled={editLocked}
                >
                  {isPromptExpanded ? '收起' : '展開'}
                </button>
              </div>
              {isPromptExpanded && (
                <textarea
                  id="customPrompt"
                  className={styles.promptArea}
                  value={customPrompt}
                  onChange={handleCustomPromptChange}
                  rows={6}
                  placeholder="請輸入您的自訂提示詞……"
                  disabled={editLocked}
                />
              )}
            </div>
          )}
        </section>

        {/* 3 · 學生名單 */}
        <section className={`${styles.panel} ${styles.rise}`}>
          <div className={styles.panelHead}>
            <span className={styles.stepBadge}>3</span>
            <span className={styles.panelTitle}>建立學生名單</span>
          </div>

          <div className={styles.listTools}>
            <label className={`${styles.uploadBtn} ${editLocked ? styles.disabled : ''}`}>
              <FontAwesomeIcon icon={faFileArrowUp} /> 上傳 Excel
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                disabled={editLocked}
                style={{ display: 'none' }}
              />
            </label>
            <button onClick={handleAddStudent} disabled={editLocked} className={styles.addStudentBtn}>
              <FontAwesomeIcon icon={faPlus} /> 新增學生
            </button>
          </div>

          <div className={styles.traitsLabel}>點選特質，快速填入目前選取的關鍵字欄位</div>
          <div className={styles.traits}>
            {commonTraits.map((trait, i) => (
              <button
                key={`common-${i}`}
                type="button"
                className={styles.chip}
                onClick={() => handleAddTraitToFocused(trait)}
                disabled={editLocked}
              >
                {trait}
              </button>
            ))}
            {customTraits.map((trait, i) => (
              <span key={`custom-${i}`} className={styles.chipCustom}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => handleAddTraitToFocused(trait)}
                  disabled={editLocked}
                >
                  {trait}
                </button>
                <button
                  type="button"
                  className={styles.chipDelete}
                  onClick={() => handleDeleteCustomTrait(trait)}
                  disabled={editLocked}
                  aria-label={`刪除特質 ${trait}`}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className={styles.chipAdd}
              onClick={handleAddCustomTrait}
              disabled={editLocked}
              aria-label="新增自訂特質"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>

          <div className={styles.tableCard}>
            {students.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <FontAwesomeIcon icon={faUsers} />
                </span>
                <div className={styles.emptyTitle}>還沒有學生</div>
                <div className={styles.emptyText}>
                  上傳含「姓名 / 特質」兩欄的 Excel，或點「新增學生」開始手動建立。
                </div>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="studentsDroppable">
                    {(provided) => (
                      <table className={styles.table} {...provided.droppableProps} ref={provided.innerRef}>
                        <thead className={styles.thead}>
                          <tr>
                            <th className={styles.colHandle}></th>
                            <th className={styles.colIndex}>#</th>
                            <th className={styles.colName}>學生姓名</th>
                            <th>關鍵詞</th>
                            <th>評語</th>
                            <th className={styles.colOps}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student, index) => (
                            <Draggable key={`student-${index}`} draggableId={`student-${index}`} index={index}>
                              {(p2) => (
                                <tr ref={p2.innerRef} {...p2.draggableProps} className={styles.row}>
                                  <td className={`${styles.td} ${styles.colHandle}`} {...p2.dragHandleProps}>
                                    <div className={styles.handle}>
                                      <FontAwesomeIcon icon={faGripVertical} />
                                    </div>
                                  </td>
                                  <td className={styles.td}>
                                    <div className={styles.indexNum}>{index + 1}</div>
                                  </td>
                                  <td className={styles.td}>
                                    <input
                                      type="text"
                                      value={student.name}
                                      onChange={(e) => handleEditStudentField(index, 'name', e.target.value)}
                                      className={styles.cellInput}
                                      disabled={isLocked}
                                      placeholder="姓名"
                                    />
                                  </td>
                                  <td className={styles.td}>
                                    <textarea
                                      value={student.keywords}
                                      onChange={(e) => handleEditStudentField(index, 'keywords', e.target.value)}
                                      rows={3}
                                      className={styles.cellArea}
                                      disabled={isLocked}
                                      placeholder="聰明，體育不錯……"
                                      onFocus={() => handleFocusKeywordField(index)}
                                    />
                                  </td>
                                  <td className={styles.td}>
                                    {isLocked && !student.comment ? (
                                      <div className={styles.shimmer} />
                                    ) : (
                                      <textarea
                                        value={student.comment}
                                        onChange={(e) => handleEditStudentField(index, 'comment', e.target.value)}
                                        rows={3}
                                        className={styles.cellArea}
                                        disabled={isLocked}
                                        placeholder="生成後的評語會出現在這裡"
                                      />
                                    )}
                                  </td>
                                  <td className={`${styles.td} ${styles.colOps}`}>
                                    <div className={styles.ops}>
                                      <button
                                        onClick={() => regenerateSingleComment(index)}
                                        disabled={!isValidKey || editLocked}
                                        className={styles.iconBtn}
                                      >
                                        <FontAwesomeIcon icon={faRedo} /> 重生
                                      </button>
                                      <button
                                        onClick={() => handleDeleteStudent(index)}
                                        disabled={editLocked}
                                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                      >
                                        <FontAwesomeIcon icon={faTrash} /> 刪除
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      </table>
                    )}
                  </Droppable>
                </DragDropContext>
                <div ref={tableEndRef} />
              </div>
            )}
          </div>
        </section>

        {/* 底部動作列 */}
        {students.length > 0 && (
          <div className={styles.actions}>
            <span className={styles.actionsCount}>
              已完成 <b>{filledCount}</b> / {students.length} 位
            </span>
            {!isGenerating && !isPaused && (
              <button
                onClick={() => generateComments(false)}
                disabled={!isValidKey}
                className={styles.primaryBtn}
              >
                <FontAwesomeIcon icon={faWandMagicSparkles} /> 生成評語
              </button>
            )}
            {isGenerating && (
              <button onClick={pauseOrResume} className={styles.pauseBtn} disabled={!isValidKey}>
                {isPaused ? (
                  <>
                    <FontAwesomeIcon icon={faPlay} /> 繼續
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPause} /> 暫停
                  </>
                )}
              </button>
            )}
            <button onClick={handleFileDownload} disabled={editLocked} className={styles.ghostBtn}>
              <FontAwesomeIcon icon={faDownload} /> 下載 Excel
            </button>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        © {copyrightYear}
        <span className={styles.footerPaw}>
          <FontAwesomeIcon icon={faPaw} />
        </span>
        <a href="https://github.com/moon-jam" target="_blank" rel="noopener noreferrer">
          Moon Jam
        </a>
        {' · '}
        <a href="https://github.com/moon-jam/AI_Gen_Semester_Comments_Tool" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        {' · MIT License'}
      </footer>

      {/* 使用教學 Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="使用教學"
        className={styles.modal}
        overlayClassName={styles.overlay}
      >
        <p className={styles.modalEyebrow}>Guide</p>
        <h2 className={styles.modalTitle}>使用教學</h2>
        <button onClick={closeModal} className={styles.closeBtn} aria-label="關閉">
          ✕
        </button>
        <div className={styles.modalBody}>
          <div className={styles.step}>
            <span className={styles.stepNo}>1</span>
            <div className={styles.stepBody}>
              <h3>建立 API Key</h3>
              <p>
                先到{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                  Google AI Studio
                </a>{' '}
                建立 API Key，複製後貼到上方的金鑰框，確認出現「金鑰有效」即設定成功（若無法順利創建，可參考這個{' '}
                <a href="https://youtu.be/ehm3-xoJLsc" target="_blank" rel="noopener noreferrer">
                  影片
                </a>
                ）。
              </p>
              <img
                src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/step-1.png"
                alt="建立 API Key 步驟"
                className={styles.modalImg}
              />
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNo}>2</span>
            <div className={styles.stepBody}>
              <h3>建立學生名單</h3>
              <details className={styles.acc}>
                <summary>方法一：上傳已有名單的 Excel</summary>
                <p>
                  建立一個 Excel 檔，A 欄輸入學生姓名，B 欄輸入幾個特質關鍵字，可參考{' '}
                  <a
                    href="https://github.com/moon-jam/AI_Gen_Semester_Comments_Tool/raw/main/sample.xlsx"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    sample.xlsx
                  </a>
                  ，接著點上方的 <span className={styles.kbd}>上傳 Excel</span>。
                </p>
                <img
                  src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/sample_excel.png"
                  alt="Excel 範例"
                  className={styles.modalImg}
                />
              </details>
              <details className={styles.acc}>
                <summary>方法二：直接在網頁上輸入</summary>
                <p>
                  點 <span className={styles.kbd}>新增學生</span>，輸入姓名與關鍵字。關鍵字可直接點上方的特質快速填入，也可以自行新增常用特質。
                </p>
                <img
                  src="https://raw.githubusercontent.com/moon-jam/AI_Gen_Semester_Comments_Tool/main/assets/sample_user_input.png"
                  alt="手動輸入範例"
                  className={styles.modalImg}
                />
              </details>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNo}>3</span>
            <div className={styles.stepBody}>
              <h3>選擇長度並生成</h3>
              <p>
                選好評語長度後，點下方的 <span className={styles.kbd}>生成評語</span> 批次生成，完成後點{' '}
                <span className={styles.kbd}>下載 Excel</span> 即可。
              </p>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNo}>
              <FontAwesomeIcon icon={faLightbulb} />
            </span>
            <div className={styles.stepBody}>
              <h3>小技巧</h3>
              <p>
                不想每次都輸入金鑰，可在第一次輸入後於瀏覽器點鑰匙圖示儲存，下次用密碼或指紋就會自動填入。
              </p>
            </div>
          </div>
        </div>
      </Modal>

      <GoogleAnalytics gaId="G-SETTK23KS8" />
    </div>
  );
}
