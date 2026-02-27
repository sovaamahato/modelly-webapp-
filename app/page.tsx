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

export default function Home() {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<UploadSlot | null>(null);

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
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Modelly</h1>
          <p className={styles.subtitle}>
            Combine your photo with a model image to create a realistic personalized result.
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
          <div className={styles.message} style={{ background: 'rgba(92, 184, 92, 0.15)', color: 'var(--success)', borderColor: 'rgba(92, 184, 92, 0.4)' }}>
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
    </main>
  );
}
