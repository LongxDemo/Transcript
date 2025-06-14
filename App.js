
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Types are for development; they are removed/commented in the transpiled JS
// import { InputMode, TranscriptionResult, ChatMessage } from './types.js'; 
import { transcribeContent, translateText, getOrInitializeChat, sendChatMessage, resetChatSession } from './services/geminiService.js';
import { LANGUAGES } from './languages.js';

// Define InputMode enum directly in JS as it's used by the logic
const InputMode = {
  FILE: 'file',
  RECORD: 'record',
  TEXT_TRANSLATE: 'text_translate',
  CHAT: 'chat',
};

// Helper: Convert Blob to Base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (result) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Failed to read blob as Base64: result is null."));
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      reject(new Error(`FileReader error: ${error.toString()}`));
    };
    reader.readAsDataURL(blob);
  });
};

const UploadIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-6 h-6 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" })
  )
);

const MicrophoneIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-6 h-6 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15c-1.125 0-2.25-.375-3.25-1.002L5 14.25V18a2.25 2.25 0 002.25 2.25h9.5A2.25 2.25 0 0019 18v-3.75l-3.75-1.248A11.196 11.196 0 0112 15zM12 12.75a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 10-4.5 0v3.75a2.25 2.25 0 002.25 2.25z" })
  )
);

const StopIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-6 h-6 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" })
  )
);

const TrashIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-5 h-5 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" })
  )
);

const GlobeAltIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-5 h-5 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.978 11.978 0 0112 16.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m0 0A11.978 11.978 0 0012 16.5c2.998 0 5.74-1.1 7.843-2.918M12 12a2.25 2.25 0 00-2.25 2.25V18a2.25 2.25 0 004.5 0v-3.75A2.25 2.25 0 0012 12z" })
  )
);

const LanguageIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-6 h-6 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: "1.5" },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21V3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0c2.485 0 4.5 4.03 4.5 9S14.485 21 12 21zm-2.25-6.75H12m1.5-1.5H12M5.25 6H18.75m-13.5 9H18.75" }),
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M15.75 6H8.25A2.25 2.25 0 006 8.25v7.5A2.25 2.25 0 008.25 18h7.5A2.25 2.25 0 0018 15.75v-7.5A2.25 2.25 0 0015.75 6zM9 12h6" })
  )
);

const ChatBubbleIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-6 h-6 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: "1.5" },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-2.184-4.368c-.717-.345-1.427-.756-2.035-1.226A4.502 4.502 0 0112 15c-.946 0-1.84.223-2.61.636a6.752 6.752 0 01-4.16-1.527C4.21 13.71 3.75 12.834 3.75 11.948v-4.286c0-.97.616-1.813 1.5-2.097M12 6.75A4.5 4.5 0 0116.5 11.25h0c0 1.518-1.02 2.817-2.456 3.195M12 6.75A4.5 4.5 0 007.5 11.25h0c0 1.518 1.02 2.817 2.456 3.195m0 0V21m0-8.805c.01.01.018.02.026.03m-.026-.03c-.01 0-.018.008-.026.014m0 0L12 12.25m-3.544 3.195c-.718-.38-1.254-.925-1.583-1.569M12 6.75a3 3 0 00-3 3h6a3 3 0 00-3-3z" })
  )
);

const PaperAirplaneIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-5 h-5 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: "1.5" },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" })
  )
);

const CopyIcon = ({ className = "" }) => (
  React.createElement('svg', { className: `w-5 h-5 stroke-slate-200 ${className}`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: "1.5" },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 01-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25V4.5A2.25 2.25 0 019 2.25h1.5A2.25 2.25 0 0113.5 4.5v0c0 .212.03.418.084.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.201a48.208 48.208 0 011.927-.184" })
  )
);

const Spinner = ({ className = "w-8 h-8" }) => (
  React.createElement('svg', { className: `${className} animate-spin text-indigo-600`, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24" },
    React.createElement('circle', { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }),
    React.createElement('path', { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })
  )
);

const App = () => {
  const [inputMode, setInputMode] = useState(InputMode.FILE);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [filePreviewMediaError, setFilePreviewMediaError] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedAudioMediaError, setRecordedAudioMediaError] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);
  const [inputText, setInputText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [chatMessages, setChatMessages] = useState([]);
  const [currentChatMessage, setCurrentChatMessage] = useState("");
  const chatMessagesEndRef = useRef(null);
  const [transcription, setTranscription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState('en-US');
  const [copyButtonText, setCopyButtonText] = useState("Copy");

  useEffect(() => {
    if (inputMode === InputMode.CHAT) {
      setIsLoading(true);
      setError(null); 
      getOrInitializeChat(targetLanguage)
        .then((success) => {
          if (!success) {
            setError("Failed to initialize chat session. This could be due to API key issues or network problems. Please check console for details or try again.");
          }
        })
        .catch(err => {
            console.error("Critical error during chat initialization:", err);
            setError("A critical error occurred while setting up chat. Please check console.");
        })
        .finally(() => setIsLoading(false));
    } else if (inputMode !== InputMode.CHAT) {
        resetChatSession(); 
    }
  }, [inputMode, targetLanguage]);

  useEffect(() => {
    if (inputMode === InputMode.CHAT) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, inputMode]);

  const clearAllInputsAndOutputs = () => {
    clearFileSelection();
    clearRecording();
    setInputText("");
    setError(null);
    setTranscription("");
    setCopyButtonText("Copy");
    setFilePreviewMediaError(false);
    setRecordedAudioMediaError(false);
  };

  const handleModeChange = (newMode) => {
    clearAllInputsAndOutputs(); 
    if (newMode !== InputMode.CHAT) {
        setChatMessages([]); 
        setCurrentChatMessage("");
        resetChatSession(); 
    }
    setInputMode(newMode);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { 
        setError("File is too large. Please select a file smaller than 20MB.");
        setSelectedFile(null);
        setFilePreviewUrl(null);
        setFilePreviewMediaError(false);
        event.target.value = ""; 
        return;
      }
      setSelectedFile(file);
      setError(null);
      setTranscription("");
      setCopyButtonText("Copy");
      setFilePreviewMediaError(false);
      if (filePreviewUrl) { 
        URL.revokeObjectURL(filePreviewUrl);
      }
      if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
        setFilePreviewUrl(URL.createObjectURL(file));
      } else {
        setFilePreviewUrl(null);
      }
    } else { 
        clearFileSelection(); 
    }
  };
  
  const clearFileSelection = () => {
    setSelectedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
    setFilePreviewMediaError(false);
    const fileInput = document.getElementById('file-upload');
    if(fileInput) fileInput.value = "";
  };

  const startRecording = useCallback(async () => {
    try {
      if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
      setRecordingTime(0);
      setRecordedAudioMediaError(false);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: '' };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options.mimeType = 'audio/ogg;codecs=opus';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options.mimeType ? options : undefined);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedAudioBlob(audioBlob);
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl); 
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
        if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null; 
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordedAudioBlob(null);
      if(recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl); 
      setRecordedAudioUrl(null); 
      setError(null);
      setTranscription("");
      setCopyButtonText("Copy");
      
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);

    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to start recording. Please ensure microphone permission is granted and try again.");
      setIsRecording(false);
      setRecordedAudioMediaError(false);
      if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, [recordedAudioUrl]); 

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); 
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearRecording = () => {
    setRecordedAudioBlob(null);
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }
    setRecordingTime(0);
    setRecordedAudioMediaError(false);
    if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
    }
  };
  
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleTranscriptionTranslationSubmit = async () => {
    if (inputMode === InputMode.CHAT) return; 

    setIsLoading(true);
    setError(null);
    setTranscription("");
    setCopyButtonText("Copy");
    let result = { text: "", error: "No valid input provided."};

    if (inputMode === InputMode.FILE && selectedFile) {
      const mimeType = selectedFile.type || "application/octet-stream"; 
      try {
        const base64Data = await blobToBase64(selectedFile);
        result = await transcribeContent(base64Data, mimeType, targetLanguage);
      } catch (e) {
        setError(`Error processing file: ${e.message}`);
        setIsLoading(false);
        return;
      }
    } else if (inputMode === InputMode.RECORD && recordedAudioBlob) {
      let mimeType = recordedAudioBlob.type;
       if (!mimeType) {
        mimeType = 'audio/webm'; 
      }
      try {
        const base64Data = await blobToBase64(recordedAudioBlob);
        result = await transcribeContent(base64Data, mimeType, targetLanguage);
      } catch (e) {
        setError(`Error processing recording: ${e.message}`);
        setIsLoading(false);
        return;
      }
    } else if (inputMode === InputMode.TEXT_TRANSLATE && inputText.trim()) {
        result = await translateText(inputText, sourceLanguage, targetLanguage);
    } else {
         setError("No content to process. Please select a file, make a recording, or enter text.");
         setIsLoading(false);
         return;
    }
    
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setTranscription(result.text);
    }
  };

  const handleSendChatMessage = async () => {
    if (!currentChatMessage.trim()) return;

    const newUserMessage = { id: Date.now().toString(), sender: 'user', text: currentChatMessage.trim() };
    setChatMessages(prev => [...prev, newUserMessage]);
    const messageToSend = currentChatMessage.trim();
    setCurrentChatMessage(""); 
    setIsLoading(true);
    setError(null);

    const result = await sendChatMessage(messageToSend, targetLanguage);
    setIsLoading(false);

    if (result.error) {
        setError(result.error);
    } else {
        const aiResponse = { id: (Date.now() + 1).toString(), sender: 'ai', text: result.text };
        setChatMessages(prev => [...prev, aiResponse]);
    }
  };

  const handleClearChat = async () => {
    setChatMessages([]);
    setCurrentChatMessage("");
    setError(null); 
    setIsLoading(true);
    resetChatSession(); 
    try {
        const success = await getOrInitializeChat(targetLanguage); // Re-initialize with current targetLanguage
        if (!success) {
            setError("Failed to re-initialize chat session after clearing. API key or service might be unavailable.");
        }
    } catch (e) {
        setError(`Error re-initializing chat: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!transcription) return;
    try {
      await navigator.clipboard.writeText(transcription);
      setCopyButtonText("Copied!");
      setTimeout(() => setCopyButtonText("Copy"), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError("Failed to copy text to clipboard.");
      setCopyButtonText("Error"); 
      setTimeout(() => setCopyButtonText("Copy"), 2000);
    }
  };

  const commonSubmitDisabled = isLoading;

  return React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center" },
    React.createElement('header', { className: "w-full max-w-3xl mb-8 text-center" },
      React.createElement('h1', { className: "text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500" }, "AI Transcriber, Translator & Chat"),
      React.createElement('p', { className: "text-slate-400 mt-2" }, "Leverage Gemini AI for audio/video transcription, text translation, and direct chat.")
    ),
    React.createElement('main', { className: "w-full max-w-3xl bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8" },
      React.createElement('div', { className: "mb-6" },
        React.createElement('div', { className: "flex border-b border-slate-700" },
          React.createElement('button', { onClick: () => handleModeChange(InputMode.FILE), className: `py-3 px-3 sm:px-4 font-medium text-xs sm:text-sm focus:outline-none transition-colors duration-200 ease-in-out ${inputMode === InputMode.FILE ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`, 'aria-pressed': inputMode === InputMode.FILE },
            React.createElement(UploadIcon, { className: "inline-block w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 align-text-bottom" }), " Upload"
          ),
          React.createElement('button', { onClick: () => handleModeChange(InputMode.RECORD), className: `py-3 px-3 sm:px-4 font-medium text-xs sm:text-sm focus:outline-none transition-colors duration-200 ease-in-out ${inputMode === InputMode.RECORD ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`, 'aria-pressed': inputMode === InputMode.RECORD },
            React.createElement(MicrophoneIcon, { className: "inline-block w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 align-text-bottom" }), " Record"
          ),
          React.createElement('button', { onClick: () => handleModeChange(InputMode.TEXT_TRANSLATE), className: `py-3 px-3 sm:px-4 font-medium text-xs sm:text-sm focus:outline-none transition-colors duration-200 ease-in-out ${inputMode === InputMode.TEXT_TRANSLATE ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`, 'aria-pressed': inputMode === InputMode.TEXT_TRANSLATE },
            React.createElement(LanguageIcon, { className: "inline-block w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 align-text-bottom" }), " Translate"
          ),
          React.createElement('button', { onClick: () => handleModeChange(InputMode.CHAT), className: `py-3 px-3 sm:px-4 font-medium text-xs sm:text-sm focus:outline-none transition-colors duration-200 ease-in-out ${inputMode === InputMode.CHAT ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'}`, 'aria-pressed': inputMode === InputMode.CHAT },
            React.createElement(ChatBubbleIcon, { className: "inline-block w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 align-text-bottom" }), " Chat"
          )
        )
      ),
      inputMode === InputMode.TEXT_TRANSLATE && React.createElement('div', { className: "mb-6" },
        React.createElement('label', { htmlFor: "source-language-select", className: "block text-sm font-medium text-slate-300 mb-1" },
          React.createElement(GlobeAltIcon, { className: "inline-block w-4 h-4 mr-1 align-text-bottom" }),
          " Source Language (for Text Translation)"
        ),
        React.createElement('select', { id: "source-language-select", value: sourceLanguage, onChange: (e) => setSourceLanguage(e.target.value), disabled: isLoading, className: "block w-full bg-slate-700 border border-slate-600 text-slate-200 py-2.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" },
          React.createElement('option', { value: "auto" }, "Auto-detect"),
          LANGUAGES.map((lang) => React.createElement('option', { key: `src-${lang.code}`, value: lang.code }, lang.name))
        )
      ),
      React.createElement('div', { className: "mb-6" },
        React.createElement('label', { htmlFor: "target-language-select", className: "block text-sm font-medium text-slate-300 mb-1" },
          React.createElement(GlobeAltIcon, { className: "inline-block w-4 h-4 mr-1 align-text-bottom" }),
          inputMode === InputMode.CHAT ? "Chat Language" : "Output Language"
        ),
        React.createElement('select', { id: "target-language-select", value: targetLanguage, onChange: (e) => setTargetLanguage(e.target.value), disabled: isLoading, className: "block w-full bg-slate-700 border border-slate-600 text-slate-200 py-2.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" },
          LANGUAGES.map((lang) => React.createElement('option', { key: `target-${lang.code}`, value: lang.code }, lang.name))
        ),
        inputMode === InputMode.CHAT && React.createElement('p', {className: "mt-1 text-xs text-slate-500"}, "The AI will primarily respond in this language.")
      ),
      inputMode === InputMode.FILE && React.createElement('div', { className: "space-y-6" },
        React.createElement('div', null,
          React.createElement('label', { htmlFor: "file-upload", className: "block text-sm font-medium text-slate-300 mb-1" }, "Select Audio or Video File"),
          React.createElement('input', { id: "file-upload", type: "file", accept: "audio/*,video/*,application/octet-stream", onChange: handleFileChange, disabled: isLoading, className: "block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-indigo-50 hover:file:bg-indigo-700 transition-colors cursor-pointer", "aria-describedby":"file-help" }),
           React.createElement('p', {id: "file-help", className: "mt-1 text-xs text-slate-500"}, "Max file size: 20MB. Supported: MP3, WAV, MP4, WEBM, etc.")
        ),
        selectedFile && React.createElement('div', { className: "p-4 bg-slate-700/50 rounded-lg" },
          React.createElement('div', { className: "flex justify-between items-center" },
            React.createElement('div', null,
              React.createElement('p', { className: "text-sm font-medium text-slate-200 break-all" }, selectedFile.name),
              React.createElement('p', { className: "text-xs text-slate-400" }, `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB - ${selectedFile.type || 'Unknown type'}`)
            ),
            React.createElement('button', { onClick: () => {clearFileSelection(); setTranscription(""); setError(null); setCopyButtonText("Copy");}, disabled: isLoading, className: "p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-full hover:bg-slate-600 ml-2 flex-shrink-0", "aria-label": "Clear file selection"}, React.createElement(TrashIcon, null))
          ),
          filePreviewUrl ? React.createElement('div', { className: "mt-3" },
            selectedFile.type.startsWith("audio/") ? 
              React.createElement('audio', { controls: true, src: filePreviewUrl, className: "w-full h-12 rounded", onError:() => setFilePreviewMediaError(true), onCanPlay: () => setFilePreviewMediaError(false), "aria-describedby": filePreviewMediaError ? "file-preview-error-message" : undefined }) :
              React.createElement('video', { controls: true, src: filePreviewUrl, className: "w-full max-h-48 rounded", onError:() => setFilePreviewMediaError(true), onCanPlay: () => setFilePreviewMediaError(false), "aria-describedby": filePreviewMediaError ? "file-preview-error-message" : undefined }),
            filePreviewMediaError && React.createElement('p', {id: "file-preview-error-message", className:"text-xs text-amber-400 mt-1.5", role: "alert"}, "Preview unavailable: browser cannot play this specific format/codec. The file might still be processable.")
          ) : ( selectedFile && 
            React.createElement('div', {className: "mt-3"}, 
              React.createElement('p', {className: "text-xs text-slate-400 px-2 py-2 bg-slate-600/60 rounded"}, 
                `No direct browser preview available for this file type (${selectedFile.type || 'unknown type'}). However, if it's a media file, you can still try to process it.`
              )
            )
          )
        ),
        React.createElement('button', { onClick: handleTranscriptionTranslationSubmit, disabled: !selectedFile || commonSubmitDisabled, className: "w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50" },
          isLoading ? React.createElement(Spinner, {className:"w-5 h-5 mr-2"}) : React.createElement(UploadIcon, {className:"w-5 h-5 mr-2"}), "Transcribe File"
        )
      ),
      inputMode === InputMode.RECORD && React.createElement('div', { className: "space-y-6 text-center" },
        !isRecording && !recordedAudioBlob && React.createElement('button', { onClick: startRecording, disabled: commonSubmitDisabled, className: "w-full sm:w-auto inline-flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors" },
          React.createElement(MicrophoneIcon, { className: "w-5 h-5 mr-2" }), " Start Recording"
        ),
        isRecording && React.createElement('div', { className: "flex flex-col items-center space-y-3" },
          React.createElement('div', {className: "text-2xl font-mono text-red-400 animate-pulse tabular-nums", "aria-live":"polite"}, formatTime(recordingTime)),
          React.createElement('button', { onClick: stopRecording, disabled: isLoading, className: "w-full sm:w-auto inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors" },
            React.createElement(StopIcon, { className: "w-5 h-5 mr-2" }), " Stop Recording"
          )
        ),
        recordedAudioBlob && recordedAudioUrl && React.createElement('div', { className: "p-4 bg-slate-700/50 rounded-lg text-left" },
          React.createElement('div', {className: "flex justify-between items-center mb-2"},
            React.createElement('p', { className: "text-sm font-medium text-slate-200" }, `Recorded Audio (${formatTime(recordingTime)})`),
            React.createElement('button', { onClick: () => {clearRecording(); setTranscription(""); setError(null); setCopyButtonText("Copy");}, disabled: isLoading, className: "p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-full hover:bg-slate-600", "aria-label":"Clear recording"}, React.createElement(TrashIcon, null))
          ),
          React.createElement('audio', { controls: true, src: recordedAudioUrl, className: "w-full h-12 rounded", onError:() => setRecordedAudioMediaError(true), onCanPlay: () => setRecordedAudioMediaError(false), "aria-describedby": recordedAudioMediaError ? "recorded-audio-preview-error-message" : undefined }),
          recordedAudioMediaError && React.createElement('p', {id: "recorded-audio-preview-error-message", className:"text-xs text-amber-400 mt-1.5", role: "alert"}, "Preview unavailable for this recording format. The recording might still be processable."),
          React.createElement('button', { onClick: handleTranscriptionTranslationSubmit, disabled: commonSubmitDisabled, className: "w-full mt-4 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors" },
            isLoading ? React.createElement(Spinner, {className:"w-5 h-5 mr-2"}) : React.createElement(MicrophoneIcon, {className:"w-5 h-5 mr-2"}), "Transcribe Recording"
          )
        )
      ),
      inputMode === InputMode.TEXT_TRANSLATE && React.createElement('div', { className: "space-y-6" },
        React.createElement('div', null,
          React.createElement('label', { htmlFor: "text-input-translate", className: "block text-sm font-medium text-slate-300 mb-1" }, "Text to Translate"),
          React.createElement('textarea', { id: "text-input-translate", rows: 6, value: inputText, onChange: (e) => setInputText(e.target.value), placeholder: "Enter text here...", disabled: isLoading, className: "block w-full bg-slate-700 border border-slate-600 text-slate-200 py-2.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder-slate-500" })
        ),
        React.createElement('button', { onClick: handleTranscriptionTranslationSubmit, disabled: !inputText.trim() || commonSubmitDisabled, className: "w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50" },
          isLoading ? React.createElement(Spinner, {className:"w-5 h-5 mr-2"}) : React.createElement(LanguageIcon, {className:"w-5 h-5 mr-2"}), "Translate Text"
        )
      ),
      inputMode === InputMode.CHAT && React.createElement('div', { className: "flex flex-col h-[60vh] sm:h-[70vh]" },
        React.createElement('div', { className: "flex justify-between items-center mb-3" },
            React.createElement('h2', { className: "text-xl font-semibold text-indigo-400" }, "Chat with AI"),
            React.createElement('button', { onClick: handleClearChat, disabled: isLoading || chatMessages.length === 0, className: "flex items-center text-sm px-3 py-1.5 rounded-md bg-slate-600 hover:bg-slate-500 text-slate-200 disabled:bg-slate-700 disabled:text-slate-500 transition-colors", "aria-label":"Clear chat history" },
                React.createElement(TrashIcon, {className:"w-4 h-4 mr-1.5"}), " Clear Chat"
            )
        ),
        React.createElement('div', { className: "flex-grow bg-slate-700/50 rounded-lg p-4 overflow-y-auto mb-4 space-y-3" },
          chatMessages.map((msg) => React.createElement('div', { key: msg.id, className: `flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}` },
            React.createElement('div', { className: `max-w-[70%] p-3 rounded-xl shadow whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-600 text-slate-100 rounded-bl-none'}` }, msg.text)
          )),
          React.createElement('div', {ref: chatMessagesEndRef})
        ),
        React.createElement('div', { className: "flex items-center space-x-2" },
          React.createElement('textarea', { value: currentChatMessage, onChange: (e) => setCurrentChatMessage(e.target.value), onKeyPress: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (currentChatMessage.trim()) { handleSendChatMessage(); }}}, placeholder: "Type your message...", rows: 1, disabled: isLoading, className: "flex-grow bg-slate-700 border border-slate-600 text-slate-200 py-2.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder-slate-500 resize-none", "aria-label":"Chat message input" }),
          React.createElement('button', { onClick: handleSendChatMessage, disabled: !currentChatMessage.trim() || isLoading, className: "bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-semibold p-3 rounded-lg transition-colors", "aria-label":"Send chat message" },
            (isLoading && currentChatMessage.trim()) ? React.createElement(Spinner, {className:"w-5 h-5"}) : React.createElement(PaperAirplaneIcon, {className:"w-5 h-5"}))
        )
      ),
      error && React.createElement('div', { className: "mt-6 p-4 bg-red-800/50 border border-red-600 text-red-200 rounded-lg", role: "alert" },
        React.createElement('p', { className: "font-semibold" }, "Error"),
        React.createElement('p', { className: "text-sm break-words" }, error)
      ),
      isLoading && inputMode !== InputMode.CHAT && React.createElement('div', { className: "mt-8 flex flex-col items-center justify-center text-center", "aria-live":"assertive"},
        React.createElement(Spinner, { className: "w-12 h-12" }),
        React.createElement('p', { className: "mt-3 text-slate-400" }, inputMode === InputMode.TEXT_TRANSLATE ? "Translating text..." : "Processing, please wait...")
      ),
      isLoading && inputMode === InputMode.CHAT && !currentChatMessage.trim() && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].sender === 'user' && React.createElement('div', {className: "mt-3 flex items-center justify-start text-slate-400", "aria-live":"polite"},
        React.createElement(Spinner, {className:"w-5 h-5 mr-2"}), " AI is thinking..."
      ),
      transcription && !isLoading && inputMode !== InputMode.CHAT && React.createElement('div', { className: "mt-8 pt-6 border-t border-slate-700" },
        React.createElement('div', { className: "flex justify-between items-center mb-3" },
          React.createElement('h2', { id: "transcription-heading", className: "text-xl font-semibold text-indigo-400" }, inputMode === InputMode.TEXT_TRANSLATE ? "Translation Result" : "Transcription Result"),
          React.createElement('button', { onClick: handleCopyToClipboard, disabled: !transcription || isLoading || copyButtonText === "Copied!", className: `flex items-center text-sm px-3 py-1.5 rounded-md transition-colors duration-150 ease-in-out ${copyButtonText === "Copied!" ? 'bg-green-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200 disabled:bg-slate-700 disabled:text-slate-500'}`, "aria-label": copyButtonText === "Copy" ? "Copy to clipboard" : "Text copied" },
             React.createElement(CopyIcon, {className: `w-4 h-4 mr-1.5 ${copyButtonText === "Copied!" ? 'hidden' : 'inline'}`}),
             copyButtonText
          )
        ),
        React.createElement('div', { className: "p-4 bg-slate-700/50 rounded-lg max-h-96 overflow-y-auto", "aria-labelledby":"transcription-heading" },
          React.createElement('p', { className: "text-slate-200 whitespace-pre-wrap break-words" }, transcription)
        )
      )
    ), 
    React.createElement('footer', { className: "w-full max-w-3xl mt-12 text-center text-xs text-slate-500" },
      React.createElement('p', null, "Ensure your API_KEY for Gemini is correctly set up in your environment or service configuration."),
      React.createElement('p', null, "Audio/video processing for transcription is done client-side before sending to Gemini API."),
      React.createElement('p', null, "For best results with video files, use short clips (e.g., under 1-2 minutes or <15MB) due to processing limits.")
    )
  ); 
}; 

export default App;
