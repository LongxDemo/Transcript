
import { GoogleGenAI } from "@google/genai";
// Types are for development; they are removed/commented in the transpiled JS
// import { TranscriptionResult } from "../types.js"; 
import { LANGUAGES } from "../languages.js";

// --- BEGIN CRITICAL API KEY SECTION ---
// ###################################################################################
// #                                                                                 #
// #                           !!! IMPORTANT SECURITY NOTICE !!!                     #
// #                                                                                 #
// # THE API KEY BELOW IS SET FOR LOCAL TESTING.                                     #
// #                                                                                 #
// # DO NOT DEPLOY THIS FILE WITH A REAL API KEY HARDCODED HERE TO A PUBLIC          #
// # REPOSITORY OR PUBLIC WEBSITE.                                                   #
// # Hardcoding API keys in client-side code is a major security risk.               #
// # Anyone viewing your website can see this key.                                   #
// #                                                                                 #
// # For production/deployment, use environment variables and a secure backend       #
// # proxy or a secure build-time injection method.                                  #
// #                                                                                 #
// ###################################################################################
const MANUALLY_SET_API_KEY = "AIzaSyAdMCwl5J3wNhEm7mx-izx9GY0aDDBModM"; // API Key has been inserted here.
// --- END CRITICAL API KEY SECTION ---

let ai = null;

if (MANUALLY_SET_API_KEY && MANUALLY_SET_API_KEY !== "YOUR_API_KEY_HERE_PLEASE_REPLACE_THIS_STRING") {
  try {
    ai = new GoogleGenAI({ apiKey: MANUALLY_SET_API_KEY });
    console.info("Gemini AI Client initialized with manually set API key. Remember this is for local testing and is insecure for deployment.");
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI with the manually provided API_KEY. The key might be invalid or there could be other issues:", e);
    // This error implies the key was found but was invalid or service couldn't init.
  }
} else if (MANUALLY_SET_API_KEY === "YOUR_API_KEY_HERE_PLEASE_REPLACE_THIS_STRING") {
  console.error(
    "CRITICAL: Gemini API Key is still set to the placeholder string in services/geminiService.js. " +
    "You MUST replace 'YOUR_API_KEY_HERE_PLEASE_REPLACE_THIS_STRING' with your actual Gemini API key. " +
    "The application's AI features will NOT function until this is done."
  );
} else {
  // This case (e.g. empty string if user modified it incorrectly)
  console.warn(
    "MANUALLY_SET_API_KEY in services/geminiService.js is missing or empty (and not the placeholder). " +
    "Gemini Service will not function. Please ensure a valid API key is provided if you intended to set one manually."
  );
}


const MODEL_NAME = "gemini-2.5-flash-preview-04-17";

// Chat instance
let chatInstance = null;
let currentChatLanguage = null;

export const transcribeContent = async (
  base64Data,
  mimeType,
  targetLanguageCode
) => {
  if (!ai) {
    return { text: "", error: "Gemini API client is not initialized. This usually means the API_KEY is missing, invalid, or was not correctly set in services/geminiService.js. Please check your setup and the browser console for more details." };
  }
  resetChatSession(); 

  const languageObj = LANGUAGES.find(lang => lang.code === targetLanguageCode);
  const fullLanguageName = languageObj ? languageObj.name : targetLanguageCode;

  const systemInstructionText = `You are a skilled linguist specializing in meticulous transcription and natural translation. Your core task is to produce translations that flow naturally and idiomatically in the target language, reflecting how a native speaker would genuinely communicate. Strive to capture all nuances and the full tone of the original.
First, accurately transcribe the audio, paying close attention to not only spoken words but also to non-lexical vocalizations (e.g., "wow!", "huh?", "ooh", "aha!"), filler words (e.g., "umm", "uhh"), and significant pauses (represented as '...'). These elements are crucial for conveying the full context and emotion.
Then, provide a translation into ${fullLanguageName} that is both precise in meaning and exceptionally natural in its expression. This translation should thoughtfully incorporate or represent the transcribed non-lexical elements in a way that is natural for a ${fullLanguageName} speaker.
The final output should feel as if it were originally created in ${fullLanguageName}, complete with its expressive vocal elements.`;

  const promptText = `The primary task is to process the provided audio content.
You should automatically detect the original language of the audio.
Your output *must* be a transcription of the speech, translated directly into ${fullLanguageName}. 
When transcribing, ensure to capture non-lexical vocalizations such as interjections (e.g., "wow!", "huh?", "ooh", "aha!"), filler words (e.g., "umm", "uhh"), and significant pauses (which can be represented by '...'). These elements should be naturally integrated into the transcription and subsequently reflected appropriately in the ${fullLanguageName} translation.
The translation must be exceptionally natural, fluent, and idiomatic in ${fullLanguageName}, as if spoken by a native, and should include the contextual meaning of these vocalizations.
Provide this ${fullLanguageName} translation with timestamps indicating the start and end time. Each timestamped segment should correspond to 10 seconds of audio.
Format each line clearly like this: [HH:MM:SS - HH:MM:SS] Translated text in ${fullLanguageName} for this segment, including any relevant vocalizations.
Ensure each timestamped segment is on a new line.
If the content is a video, transcribe and translate its audio according to these instructions.
Return *only* the translated and timestamped text in ${fullLanguageName}. Do not include any other explanatory text, introduction, or the original language transcription.`;

  try {
    const audioContentPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const instructionTextPart = {
      text: promptText,
    };
    
    const contents = [{ parts: [instructionTextPart, audioContentPart] }];

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstructionText,
      }
    });

    const transcription = response.text;
    if (transcription === undefined || transcription === null || typeof transcription !== 'string') { 
      if (response.candidates && response.candidates[0] && response.candidates[0].finishReason !== 'STOP') {
        const reason = response.candidates[0].finishReason;
        const safetyRatings = response.candidates[0].safetyRatings;
        console.warn(`Transcription may be incomplete or blocked. Reason: ${reason}`, safetyRatings);
        return { text: "", error: `Transcription failed or content was blocked. Reason: ${reason}. Please check content safety guidelines.` };
      }
      return { text: "", error: "Received no valid text from the API. The model might not have understood the request, the audio was silent/unintelligible, or the translation to the target language failed." };
    }
    return { text: transcription };

  } catch (error) {
    console.error("Error transcribing content with Gemini:", error);
    let errorMessage = "Failed to transcribe content.";
    const typedError = error; 
    if (typedError && typedError.message) {
        errorMessage = `Gemini API Error: ${typedError.message}`;
        if (typedError.message.includes("DEADLINE_EXCEEDED")) {
            errorMessage = "The request to the AI model timed out. The file might be too large or complex. Please try with a smaller file or shorter recording.";
        } else if (typedError.message.includes("400")) {
            errorMessage = "The request was malformed (Bad Request). This could be due to an unsupported file type/format, data issue, or unsupported language/parameter. Please check the console.";
        } else if (typedError.message.toLowerCase().includes("api key not valid") || typedError.message.toLowerCase().includes("permission_denied")) {
            errorMessage = "Invalid API Key or Permission Denied. Please ensure your API_KEY is correctly configured, valid, and has the necessary permissions for the Gemini API.";
        } else if (typedError.message.includes("Vertex AI API has not been used in project") || typedError.message.includes("project has not enabled") || typedError.message.includes("service is not available")) {
            errorMessage = "API not enabled or service unavailable. Please ensure the Generative Language API (or Vertex AI API) is enabled in your Google Cloud project and billing is configured."
        }
    } else if (typeof error === 'string') {
        errorMessage += ` Details: ${error}`;
    }
    
    return { text: "", error: errorMessage };
  }
};

export const translateText = async (
  textToTranslate,
  sourceLanguageCode, 
  targetLanguageCode
) => {
  if (!ai) {
     return { text: "", error: "Gemini API client is not initialized. This usually means the API_KEY is missing, invalid, or was not correctly set in services/geminiService.js. Please check your setup and the browser console for more details." };
  }
  resetChatSession();

  const targetLanguageObj = LANGUAGES.find(lang => lang.code === targetLanguageCode);
  const targetLanguageName = targetLanguageObj ? targetLanguageObj.name : targetLanguageCode;
  
  const systemInstructionText = `You are an expert translation assistant with a knack for natural language. Your mission is to provide translations that are not just accurate, but also feel completely natural and fluent in the target language (${targetLanguageName}). Imagine you're explaining this to a friend in ${targetLanguageName} – that's the tone and style to aim for. Avoid any stiffness, overly formal language, or direct literal translations that don't capture the true idiomatic meaning.
The priority is a translation that reads or sounds like it was originally crafted by a native ${targetLanguageName} speaker.`;

  let promptText = "";

  if (sourceLanguageCode === "auto") {
    promptText = `Detect the language of the following text and then translate it into ${targetLanguageName}.
The translation must be exceptionally natural, fluent, and idiomatic in ${targetLanguageName}, capturing the original's intent perfectly.
Return *only* the translated text in ${targetLanguageName}. Do not include any other explanatory text, introduction, or the original language text.

Text to translate:
"${textToTranslate}"`;
  } else {
    const sourceLanguageObj = LANGUAGES.find(lang => lang.code === sourceLanguageCode);
    const sourceLanguageName = sourceLanguageObj ? sourceLanguageObj.name : sourceLanguageCode;
    promptText = `Translate the following text from ${sourceLanguageName} into ${targetLanguageName}.
The translation must be exceptionally natural, fluent, and idiomatic in ${targetLanguageName}, capturing the original's intent perfectly.
Return *only* the translated text in ${targetLanguageName}. Do not include any other explanatory text, introduction, or the original language text.

Text to translate:
"${textToTranslate}"`;
  }

  try {
    const textPart = { text: promptText };
    const contents = [{ parts: [textPart] }];

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstructionText,
      }
    });

    const translation = response.text;
    if (translation === undefined || translation === null || typeof translation !== 'string') { 
       return { text: "", error: "Received no valid text from the API for translation. The model might not have understood the request or the translation failed." };
    }
    return { text: translation };

  } catch (error) {
    console.error("Error translating text with Gemini:", error);
    let errorMessage = "Failed to translate text.";
    const typedError = error;
     if (typedError && typedError.message) {
        errorMessage = `Gemini API Error: ${typedError.message}`;
         if (typedError.message.toLowerCase().includes("api key not valid") || typedError.message.toLowerCase().includes("permission_denied")) {
            errorMessage = "Invalid API Key or Permission Denied. Please ensure your API_KEY is correctly configured and valid.";
        }
    } else if (typeof error === 'string') {
        errorMessage += ` Details: ${error}`;
    }
    return { text: "", error: errorMessage };
  }
};

export const getOrInitializeChat = async (targetLanguageCode) => {
  if (!ai) {
    console.error("Gemini API client not initialized for chat. Check API_KEY in services/geminiService.js and browser console for errors.");
    return false;
  }
  if (chatInstance && currentChatLanguage === targetLanguageCode) {
    return true; 
  }

  const languageObj = LANGUAGES.find(lang => lang.code === targetLanguageCode);
  const targetLanguageName = languageObj ? languageObj.name : targetLanguageCode;
  
  const systemInstruction = `You are a helpful and versatile AI assistant. 
Your primary goal is to respond in ${targetLanguageName}. 
If the user's query implies a different language or context, adapt naturally. 
Be friendly, concise, and informative.`;

  try {
    chatInstance = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
      },
    });
    currentChatLanguage = targetLanguageCode;
    console.log(`Chat initialized/re-initialized for ${targetLanguageName}`);
    return true;
  } catch (error) {
    console.error("Error initializing chat session:", error);
     let errorMessage = "Failed to initialize chat session.";
     const typedError = error;
     if (typedError && typedError.message) {
        if (typedError.message.toLowerCase().includes("api key not valid") || typedError.message.toLowerCase().includes("permission_denied")) {
            errorMessage = "Invalid API Key or Permission Denied for chat initialization. Check API_KEY in services/geminiService.js.";
        } else {
            errorMessage = `Chat Init Error: ${typedError.message}`;
        }
     }
    console.error(errorMessage); 
    chatInstance = null;
    currentChatLanguage = null;
    return false;
  }
};

export const sendChatMessage = async (
  message,
  targetLanguageCode
) => {
  if (!ai) {
    return { text: "", error: "Gemini API client is not initialized. Check API_KEY in services/geminiService.js and browser console for errors." };
  }
  
  const chatInitialized = await getOrInitializeChat(targetLanguageCode);
  if (!chatInstance || !chatInitialized) {
    return { text: "", error: "Chat session is not initialized or failed to initialize. Please check API Key (in services/geminiService.js) and language selection. See browser console for more details." };
  }

  try {
    const response = await chatInstance.sendMessage({ message });
    const chatResponseText = response.text;
    if (chatResponseText === undefined || chatResponseText === null || typeof chatResponseText !== 'string') { 
      return { text: "", error: "Received an empty or invalid response from the AI." };
    }
    return { text: chatResponseText };
  } catch (error) {
    console.error("Error sending chat message with Gemini:", error);
    let errorMessage = "Failed to get a response from the AI.";
    const typedError = error;
     if (typedError && typedError.message) {
        errorMessage = `Gemini API Error: ${typedError.message}`;
         if (typedError.message.toLowerCase().includes("api key not valid") || typedError.message.toLowerCase().includes("permission_denied")) {
            errorMessage = "Invalid API Key or Permission Denied for chat message. Check API_KEY in services/geminiService.js.";
        }
    } else if (typeof error === 'string') {
        errorMessage += ` Details: ${error}`;
    }
    return { text: "", error: errorMessage };
  }
};

export const resetChatSession = () => {
  chatInstance = null;
  currentChatLanguage = null;
  console.log("Chat session reset.");
};
