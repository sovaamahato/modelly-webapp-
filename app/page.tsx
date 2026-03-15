'use client';

import { useCallback, useState } from 'react';
import { generateImage, ping } from './actions';
import styles from './page.module.css';

type UploadSlot = 'user' | 'model';

const PRESET_MODELS = [
  {
    id: 'casual',
    label: 'Casual',
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80',
  },
  {
    id: 'formal',
    label: 'Formal',
    url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80',
  },
  {
    id: 'street',
    label: 'Street',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80',
  },
];

const CORE_FEATURES = [
  {
    title: 'AI-Powered Creation Engine',
    description: 'Our model blends your photo with any style image to produce natural, photorealistic results.',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80',
  },
  {
    title: 'High-Quality Output',
    description: 'Generate sharp, detailed images suitable for portfolios, social media, or personal use.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
  },
  {
    title: 'Fast Generation',
    description: 'Get your personalized image in seconds. No queues, no waiting — instant results.',
    image: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=600&q=80',
  },
  {
    title: 'Privacy First',
    description: 'Your photos are processed securely. We do not store or train on your images.',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&q=80',
  },
];

const USE_CASES = [
  {
    title: 'Social media',
    description: 'Stand out with unique, personalized looks for Instagram, TikTok, or LinkedIn.',
    icon: '📱',
  },
  {
    title: 'Virtual try-on',
    description: 'See how different outfits and styles look on you before you buy or commit.',
    icon: '👔',
  },
  {
    title: 'Portfolio & creative',
    description: 'Create striking visuals for your portfolio, mood boards, or creative projects.',
    icon: '✨',
  },
  {
    title: 'Gifts & fun',
    description: 'Surprise friends with custom images or try celebrity and editorial styles for fun.',
    icon: '🎁',
  },
];

const TIPS = [
  'Use a clear, well-lit photo of yourself — front-facing or a slight angle works best.',
  'For the model image, choose an outfit or style shot on a similar body type for more natural results.',
  'Avoid heavy filters or low-resolution images; the AI works best with sharp, recognizable faces.',
  'Try our Casual, Formal, or Street templates first if you’re not sure what to upload.',
];

const FAQ_ITEMS = [
  {
    question: 'What kind of photos work best?',
    answer: 'Use a clear selfie or full-body photo with good lighting. The AI works best with front-facing or slight-angle shots. Avoid heavy filters or obscured faces.',
  },
  {
    question: 'How long does generation take?',
    answer: 'Typically a few seconds. Generation time depends on server load but is usually under 30 seconds.',
  },
  {
    question: 'Is my data stored?',
    answer: 'We process your images to generate results and do not retain them for training or storage. Your privacy is a priority.',
  },
  {
    question: 'What image formats are supported?',
    answer: 'You can upload JPEG, PNG, or WebP images. Each file should be under 4MB for best performance.',
  },
  {
    question: 'Can I use the generated images commercially?',
    answer: 'Generated images are for personal and creative use. Check the terms of the AI provider (e.g. fal.ai) if you plan to use results commercially.',
  },
];

export default function Home() {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<UploadSlot | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** Resize image to max 1024px and compress to JPEG to keep request under body limits */
  const resizeImageForUpload = useCallback(
    (dataUrl: string, filename: string): Promise<Blob> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const max = 512;
          let w = img.width;
          let h = img.height;
          if (w > max || h > max) {
            if (w > h) {
              h = Math.round((h * max) / w);
              w = max;
            } else {
              w = Math.round((w * max) / h);
              h = max;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Resize failed'))),
            'image/jpeg',
            0.7
          );
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = dataUrl;
      }),
    []
  );

  const validateFile = (file: File): boolean => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please use JPEG, PNG, or WebP images.');
      return false;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Each image must be 4MB or smaller.');
      return false;
    }
    return true;
  };

  const handleFile = useCallback(
    async (file: File, slot: UploadSlot) => {
      if (!validateFile(file)) return;
      setError(null);
      const dataUrl = await readFile(file);
      if (slot === 'user') {
        setUserImage(dataUrl);
      } else {
        setModelImage(dataUrl);
        setModelFile(file);
      }
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent, slot: UploadSlot) => {
      e.preventDefault();
      setDragOver(null);
      const file = e.dataTransfer.files?.[0];
      if (file?.type.startsWith('image/')) handleFile(file, slot);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent, slot: UploadSlot) => {
    e.preventDefault();
    setDragOver(slot);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, slot: UploadSlot) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file, slot);
      e.target.value = '';
    },
    [handleFile]
  );

  const selectPreset = useCallback(async (url: string) => {
    setError(null);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], 'preset.jpg', { type: 'image/jpeg' });
      const dataUrl = await readFile(file);
      setModelImage(dataUrl);
      setModelFile(file);
    } catch {
      setError('Could not load preset image.');
    }
  }, []);

  const generate = useCallback(async () => {
    if (!userImage || (!modelImage && !modelFile)) {
      setError('Please upload both your photo and a model image.');
      return;
    }
    setError(null);
    setLoading(true);
    setResultImage(null);

    try {
      const formData = new FormData();
      const userBlob = await resizeImageForUpload(userImage, 'user.jpg');
      formData.append('userImage', userBlob, 'user.jpg');
      if (modelImage) {
        const modelBlob = await resizeImageForUpload(modelImage, 'model.jpg');
        formData.append('modelImage', modelBlob, 'model.jpg');
      }

      const data = await generateImage(formData);

      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.image) {
        setResultImage(data.image);
      } else {
        setError('No image returned.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [userImage, modelImage, modelFile]);

  const download = useCallback(() => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `modelly-${Date.now()}.png`;
    a.click();
  }, [resultImage]);

  return (
    <main className={styles.page}>
      {/* Hero */}
      <section id="hero" className={styles.hero}>
        <div className={styles.heroBg} aria-hidden />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Generator AI
            <br />
            <span className={styles.heroTitleAccent}>Modelly</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Combine your photo with any model image to create stunning, realistic
            personalized results in seconds. Powered by AI — no design skills needed.
          </p>
          <div className={styles.heroCtas}>
            <a href="#create" className={styles.heroCta}>
              Start Now
            </a>
            <a href="#how-it-works" className={styles.heroCtaSecondary}>
              See how it works
            </a>
          </div>
          <p className={styles.heroDisclaimer}>
            Upload your photo and a style image. Results are generated in seconds.
          </p>
        </div>
        <div className={styles.heroDeco} aria-hidden />
      </section>

      {/* How to Use on Modelly */}
      <section id="how-it-works" className={styles.section}>
        <div className={styles.containerWide}>
          <h2 className={styles.sectionTitle}>How to Use on Modelly</h2>
          <p className={styles.sectionSubtitle}>
            Three simple steps to your personalized model image.
          </p>
          <ul className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepIcon} data-step="1" />
              <h3 className={styles.stepTitle}>Upload your photo</h3>
              <p className={styles.stepText}>
                Add a clear selfie or full-body photo. The AI uses your face and pose as the base.
              </p>
            </li>
            <li className={styles.step}>
              <span className={styles.stepIcon} data-step="2" />
              <h3 className={styles.stepTitle}>Choose a model image</h3>
              <p className={styles.stepText}>
                Pick a template or upload any outfit, style, or pose you want to try on.
              </p>
            </li>
            <li className={styles.step}>
              <span className={styles.stepIcon} data-step="3" />
              <h3 className={styles.stepTitle}>Generate & download</h3>
              <p className={styles.stepText}>
                Get your personalized image in seconds. Download and share.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Core Features — 2x2 with images */}
      <section id="features" className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.containerWide}>
          <h2 className={styles.sectionTitle}>Modelly Core Features</h2>
          <p className={styles.sectionSubtitle}>
            Built for quality, speed, and your privacy.
          </p>
          <div className={styles.coreFeaturesGrid}>
            {CORE_FEATURES.map((feature, i) => (
              <div key={i} className={styles.coreFeatureCard}>
                <div className={styles.coreFeatureImgWrap}>
                  <img src={feature.image} alt="" className={styles.coreFeatureImg} />
                </div>
                <h3 className={styles.coreFeatureTitle}>{feature.title}</h3>
                <p className={styles.coreFeatureText}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className={styles.section}>
        <div className={styles.containerWide}>
          <h2 className={styles.sectionTitle}>What you can create</h2>
          <p className={styles.sectionSubtitle}>
            From social feeds to virtual try-on — here’s how people use Modelly.
          </p>
          <div className={styles.useCasesGrid}>
            {USE_CASES.map((useCase, i) => (
              <div key={i} className={styles.useCaseCard}>
                <span className={styles.useCaseIcon} aria-hidden>{useCase.icon}</span>
                <h3 className={styles.useCaseTitle}>{useCase.title}</h3>
                <p className={styles.useCaseText}>{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Tips for best results</h2>
          <p className={styles.sectionSubtitle}>
            Get the most natural and realistic outputs with these quick tips.
          </p>
          <ul className={styles.tipsList}>
            {TIPS.map((tip, i) => (
              <li key={i} className={styles.tipItem}>
                <span className={styles.tipBullet} aria-hidden>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <p className={styles.sectionSubtitle}>
            Quick answers about Modelly.
          </p>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item, i) => (
              <div
                key={i}
                className={`${styles.faqItem} ${faqOpen === i ? styles.faqItemOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.faqQuestion}
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  {item.question}
                  <span className={styles.faqChevron} aria-hidden>▼</span>
                </button>
                <div className={styles.faqAnswerWrap}>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create — main tool */}
      <section id="create" className={styles.section}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h2 className={styles.title}>Create your image</h2>
            <p className={styles.subtitle}>
              Upload your photo and a model image to generate a personalized result.
            </p>
          </header>

        <section className={styles.uploads}>
          <div
            className={`${styles.uploadBox} ${dragOver === 'user' ? styles.dragOver : ''}`}
            onDrop={(e) => onDrop(e, 'user')}
            onDragOver={(e) => onDragOver(e, 'user')}
            onDragLeave={onDragLeave}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onInputChange(e, 'user')}
              id="user-upload"
            />
            <label htmlFor="user-upload" className={styles.uploadLabel}>
              {userImage ? (
                <span className={styles.previewWrap}>
                  <img src={userImage} alt="Your photo" className={styles.previewImg} />
                </span>
              ) : (
                <>
                  <span className={styles.uploadIcon}>📷</span>
                  <span>Your photo</span>
                  <span className={styles.uploadHint}>Selfie or full-body</span>
                  <span className={styles.uploadDnd}>Drag & drop or click</span>
                </>
              )}
            </label>
          </div>

          <div
            className={`${styles.uploadBox} ${dragOver === 'model' ? styles.dragOver : ''}`}
            onDrop={(e) => onDrop(e, 'model')}
            onDragOver={(e) => onDragOver(e, 'model')}
            onDragLeave={onDragLeave}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onInputChange(e, 'model')}
              id="model-upload"
            />
            <label htmlFor="model-upload" className={styles.uploadLabel}>
              {modelImage ? (
                <span className={styles.previewWrap}>
                  <img src={modelImage} alt="Model" className={styles.previewImg} />
                </span>
              ) : (
                <>
                  <span className={styles.uploadIcon}>👗</span>
                  <span>Model image</span>
                  <span className={styles.uploadHint}>Outfit / pose / style</span>
                  <span className={styles.uploadDnd}>Drag & drop or click</span>
                </>
              )}
            </label>
          </div>
        </section>

        <section className={styles.presets}>
          <p className={styles.presetsLabel}>Or pick a template:</p>
          <div className={styles.presetsGrid}>
            {PRESET_MODELS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={styles.presetBtn}
                onClick={() => selectPreset(preset.url)}
              >
                <span className={styles.presetImgWrap}>
                  <img src={preset.url} alt={preset.label} className={styles.presetImg} />
                </span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={async () => {
              setConnectionTest(null);
              try {
                const r = await ping();
                setConnectionTest(r.ok ? r.message : 'Unexpected response');
                setError(null);
              } catch (e) {
                setConnectionTest('Failed: ' + (e instanceof Error ? e.message : 'unknown'));
              }
            }}
          >
            Test connection
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={generate}
            disabled={loading || !userImage || !modelImage}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Generating…
              </>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>

        {connectionTest && (
          <div className={`${styles.message} ${styles.successMessage}`}>
            {connectionTest}
          </div>
        )}
        {error && (
          <div className={`${styles.message} ${styles.error}`} role="alert">
            {error}
          </div>
        )}

        {(resultImage || loading) && (
          <section className={styles.result}>
            <h2 className={styles.resultTitle}>Result</h2>
            <div className={styles.resultPreview}>
              {loading ? (
                <div className={styles.resultLoading}>
                  <span className={`${styles.spinner} ${styles.spinnerLarge}`} />
                  <p>Creating your image…</p>
                </div>
              ) : resultImage ? (
                <>
                  <img src={resultImage} alt="Generated result" className={styles.resultImg} />
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={download}>
                    Download Image
                  </button>
                </>
              ) : null}
            </div>
          </section>
        )}
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <div className={styles.finalCtaContent}>
          <span className={styles.finalCtaLogo} aria-hidden>◇</span>
          <h2 className={styles.finalCtaTitle}>Experience Modelly Now</h2>
          <p className={styles.finalCtaText}>
            Create your first AI-powered personalized model image in seconds. No sign-up required.
          </p>
          <a href="#create" className={styles.finalCtaBtn}>
            Start Now
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerWrap}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogoIcon}>◇</span>
            <span>Modelly</span>
          </div>
          <p className={styles.footerTagline}>
            AI-powered personalized model images. Create something unique.
          </p>
          <div className={styles.footerLinks}>
            <a href="#hero">Home</a>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#use-cases">Use cases</a>
            <a href="#faq">FAQ</a>
            <a href="#create">Create</a>
          </div>
          <p className={styles.footerCopy}>
            © {new Date().getFullYear()} Modelly. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
