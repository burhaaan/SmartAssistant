interface VoiceServiceCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStart: () => void;
  onEnd: () => void;
}

class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private callbacks: VoiceServiceCallbacks | null = null;

  constructor() {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    // Configure recognition settings
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    // Handle results
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Send interim results for real-time feedback
      if (interimTranscript && this.callbacks) {
        this.callbacks.onTranscript(interimTranscript, false);
      }

      // Send final results
      if (finalTranscript && this.callbacks) {
        this.callbacks.onTranscript(finalTranscript, true);
      }
    };

    // Handle start
    this.recognition.onstart = () => {
      this.isRecording = true;
      this.callbacks?.onStart();
    };

    // Handle end
    this.recognition.onend = () => {
      this.isRecording = false;
      this.callbacks?.onEnd();
    };

    // Handle errors
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error occurred';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error occurred. Please check your connection.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition was aborted.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      this.callbacks?.onError(errorMessage);
      this.isRecording = false;
    };
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public startRecording(callbacks: VoiceServiceCallbacks): boolean {
    if (!this.recognition || this.isRecording) {
      return false;
    }

    this.callbacks = callbacks;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      callbacks.onError('Failed to start speech recognition');
      return false;
    }
  }

  public stopRecording(): boolean {
    if (!this.recognition || !this.isRecording) {
      return false;
    }

    try {
      this.recognition.stop();
      return true;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      return false;
    }
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  public toggleRecording(callbacks: VoiceServiceCallbacks): boolean {
    if (this.isRecording) {
      return this.stopRecording();
    } else {
      return this.startRecording(callbacks);
    }
  }
}

// Create singleton instance
export const voiceService = new VoiceService();

// Type declarations for browser APIs
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start(): void;
  stop(): void;
  abort(): void;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
}; 