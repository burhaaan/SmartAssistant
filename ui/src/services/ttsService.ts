interface TTSServiceCallbacks {
  onStart: () => void;
  onEnd: () => void;
  onPause: () => void;
  onResume: () => void;
  onError: (error: string) => void;
  onProgress?: (currentWord: number, totalWords: number) => void;
}

interface VoiceSettings {
  rate: number; // 0.1 to 10
  pitch: number; // 0 to 2
  volume: number; // 0 to 1
  voice: SpeechSynthesisVoice | null;
}

class TTSService {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isPlaying = false;
  private isPaused = false;
  private callbacks: TTSServiceCallbacks | null = null;
  private settings: VoiceSettings = {
    rate: 1.3,
    pitch: 1,
    volume: 0.8,
    voice: null
  };

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeDefaultVoice();
  }

  private async initializeDefaultVoice() {
    // Wait for voices to load
    if (this.synthesis.getVoices().length === 0) {
      await new Promise(resolve => {
        this.synthesis.addEventListener('voiceschanged', resolve, { once: true });
      });
    }
    
    // Set default voice (prefer English voices)
    const voices = this.getAvailableVoices();
    const englishVoice = voices.find(voice => 
      voice.lang.startsWith('en') && voice.localService
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    
    if (englishVoice) {
      this.settings.voice = englishVoice;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  public updateSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  public speak(text: string, callbacks: TTSServiceCallbacks): boolean {
    if (!this.isSupported()) {
      callbacks.onError('Text-to-speech is not supported in this browser');
      return false;
    }

    // Stop any current speech
    this.stop();

    // Clean text for better speech
    const cleanText = this.cleanTextForSpeech(text);
    
    this.callbacks = callbacks;
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    
    // Apply settings
    this.currentUtterance.rate = this.settings.rate;
    this.currentUtterance.pitch = this.settings.pitch;
    this.currentUtterance.volume = this.settings.volume;
    if (this.settings.voice) {
      this.currentUtterance.voice = this.settings.voice;
    }

    // Set up event handlers
    this.currentUtterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.callbacks?.onStart();
    };

    this.currentUtterance.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.callbacks?.onEnd();
      this.currentUtterance = null;
    };

    this.currentUtterance.onpause = () => {
      this.isPaused = true;
      this.callbacks?.onPause();
    };

    this.currentUtterance.onresume = () => {
      this.isPaused = false;
      this.callbacks?.onResume();
    };

    this.currentUtterance.onerror = (event) => {
      this.isPlaying = false;
      this.isPaused = false;
      this.callbacks?.onError(`Speech synthesis error: ${event.error}`);
      this.currentUtterance = null;
    };

    // Start speaking
    try {
      this.synthesis.speak(this.currentUtterance);
      return true;
    } catch (error) {
      callbacks.onError('Failed to start text-to-speech');
      return false;
    }
  }

  public pause(): boolean {
    if (!this.isPlaying || this.isPaused) return false;
    
    try {
      this.synthesis.pause();
      return true;
    } catch (error) {
      console.error('Error pausing speech:', error);
      return false;
    }
  }

  public resume(): boolean {
    if (!this.isPaused) return false;
    
    try {
      this.synthesis.resume();
      return true;
    } catch (error) {
      console.error('Error resuming speech:', error);
      return false;
    }
  }

  public stop(): boolean {
    try {
      this.synthesis.cancel();
      this.isPlaying = false;
      this.isPaused = false;
      this.currentUtterance = null;
      return true;
    } catch (error) {
      console.error('Error stopping speech:', error);
      return false;
    }
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  public isCurrentlyPaused(): boolean {
    return this.isPaused;
  }

  private cleanTextForSpeech(text: string): string {
    return text
      // Remove markdown-style formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, 'link')
      // Replace emojis with descriptions
      .replace(/🚀/g, 'rocket')
      .replace(/✨/g, 'sparkles')
      .replace(/🎯/g, 'target')
      .replace(/⚠️/g, 'warning')
      .replace(/🤖/g, 'robot')
      .replace(/📊/g, 'chart')
      .replace(/🔍/g, 'search')
      .replace(/👥/g, 'people')
      .replace(/🎤/g, 'microphone')
      .replace(/❤️/g, 'heart')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Create singleton instance
export const ttsService = new TTSService(); 