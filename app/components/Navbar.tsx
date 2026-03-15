'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { href: '#hero', label: 'Home' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#create', label: 'Create' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className={styles.nav} role="navigation">
      <div className={styles.wrap}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>◇</span>
          <span>Modelly</span>
        </Link>

        <ul className={`${styles.links} ${open ? styles.linksOpen : ''}`}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.link}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className={styles.ctaWrap}>
            <Link
              href="#create"
              className={styles.ctaBtn}
              onClick={() => setOpen(false)}
            >
              Try Now
            </Link>
          </li>
        </ul>

        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
      </div>
    </nav>
  );
}
