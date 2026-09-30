import React, {
  useEffect,
  useRef,
  useState
} from 'react';

import { useStore } from '../state/StoreContext';

import {
  IconUpload,
  IconSave,
  IconExport,
  IconGrid,
  IconTrash,
  IconUndo,
  IconRedo
} from '../assets/math-icons';
import myLogo from "../assets/My logo.png";

export default function TopBar({
  onOpenSampleModal
}) {
  const {
    pdfFileName,
    loadPdf,
    saveProject,
    exportPdf,
    clearCurrentPage,
    undo,
    redo,
    canUndo,
    canRedo,
    gridType,
    setGridType,
    theme,
    setTheme,
    isLoading
  } = useStore();

  const fileInputRef = useRef(null);

  const [
    isFullscreen,
    setIsFullscreen
  ] = useState(false);

  const [
    isAboutOpen,
    setIsAboutOpen
  ] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(document.fullscreenElement)
      );
    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error(
        'Fullscreen failed:',
        error
      );
    }
  };

  const handleFileChange = e => {
    const file = e.target.files?.[0];

    if (file) {
      loadPdf(file);
    }

    e.target.value = '';
  };

  const cycleGrid = () => {
    const types = [
      'millimeter',
      'cartesian',
      'isometric',
      'none'
    ];

    const index = types.indexOf(gridType);

    setGridType(
      types[(index + 1) % types.length]
    );
  };

  const cycleTheme = () => {
    const themes = [
      'paper',
      'blueprint',
      'parchment',
      'chalkboard'
    ];

    const index = themes.indexOf(theme);

    setTheme(
      themes[(index + 1) % themes.length]
    );
  };

  return (
    <>
      {/* =====================================================
          TOP BAR
          ===================================================== */}

      <header className="geocanvas-header">

        <div className="header-vector-art">
          <span className="vector-line line-a" />
          <span className="vector-line line-b" />
          <span className="vector-line line-c" />
          <span className="vector-circle" />
          <span className="vector-angle" />
        </div>

        <div className="header-brand">

          <div className="brand-symbol">
            <span>△</span>
            <i />
            <b />
          </div>

          <div className="brand-copy">
            <h1>
              GeoCanvas
            </h1>

            <span>
              DIGITAL MATHEMATICS WORKSPACE
            </span>
          </div>

        </div>

        <div className="header-document">

          <span className="document-label">
            WORKSPACE
          </span>

          <span
            className="document-name"
            title={pdfFileName}
          >
            {pdfFileName ||
              'Blank Workspace'}
          </span>

        </div>

        <div className="header-center-actions">

          <button
            className="header-icon-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <IconUndo size={18} />
          </button>

          <button
            className="header-icon-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <IconRedo size={18} />
          </button>

          <span className="header-separator" />

          <button
            className="header-icon-btn danger"
            onClick={clearCurrentPage}
            title="Clear page"
          >
            <IconTrash size={18} />
          </button>

          <button
            className="fullscreen-btn"
            onClick={toggleFullscreen}
            title={
              isFullscreen
                ? 'Exit fullscreen'
                : 'Fullscreen'
            }
          >
            {isFullscreen ? '↙' : '⛶'}
          </button>

        </div>

        <div className="header-actions">

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={handleFileChange}
          />

          <button
            className="header-action-btn"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <IconUpload size={16} />
            <span>PDF</span>
          </button>

          <button
            className="header-action-btn"
            onClick={onOpenSampleModal}
          >
            <span>Worksheets</span>
          </button>

          <button
            className="header-action-btn"
            onClick={cycleGrid}
            title={`Grid: ${gridType}`}
          >
            <IconGrid size={16} />
            <span>
              {gridType}
            </span>
          </button>

          <button
            className="header-action-btn"
            onClick={cycleTheme}
          >
            <span>
              {theme}
            </span>
          </button>

          <button
            className="header-action-btn"
            onClick={saveProject}
          >
            <IconSave size={16} />
            <span>Save</span>
          </button>

          <button
            className="header-export-btn"
            onClick={exportPdf}
            disabled={isLoading}
          >
            <IconExport size={16} />

            <span>
              {isLoading
                ? 'Exporting'
                : 'Export PDF'}
            </span>
          </button>

          {/* ABOUT TAB */}

          <button
            className={`about-btn ${isAboutOpen
              ? 'about-btn-active'
              : ''
              }`}
            onClick={() =>
              setIsAboutOpen(true)
            }
            title="About GeoCanvas"
          >
            <span className="about-question">
              ?
            </span>

            <span>
              About
            </span>
          </button>

        </div>

      </header>


      {/* =====================================================
          ABOUT SHOWCASE
          ===================================================== */}

      {isAboutOpen && (
        <div
          className="about-overlay"
          onMouseDown={() =>
            setIsAboutOpen(false)
          }
        >

          <div
            className="about-showcase"
            onMouseDown={e =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}

            <button
              className="about-close"
              onClick={() =>
                setIsAboutOpen(false)
              }
              aria-label="Close About"
            >
              ×
            </button>


            {/* =================================================
                HERO
                ================================================= */}

            <div className="about-logo-area">
              <img
                src={myLogo}
                alt="My Logo"
                className="about-logo"
              />
            </div>
            <section className="about-hero">

              <div className="about-eyebrow">
                GEOCANVAS • ABOUT
              </div>

              <h1>
                Built to make
                <span> mathematics</span>
                <br />
                more interactive.
              </h1>

              <p>
                GeoCanvas is a digital mathematics workspace
                designed to bring traditional mathematical
                tools into a modern, touchscreen-friendly
                environment.
              </p>

            </section>


            {/* =================================================
                ABOUT ME + PURPOSE
                ================================================= */}

            <section className="about-intro-grid">

              <div className="about-info-card">

                <div className="about-card-icon">
                  ⌘
                </div>

                <span className="about-card-label">
                  THE DEVELOPER
                </span>

                <h2>
                  Hi, I'm Muhammad Aayan.
                </h2>

                <p>
                  I'm a student and aspiring software
                  developer interested in computer science,
                  frontend development, mathematics and
                  building technology that solves
                  real-world problems.
                </p>

                <p>
                  I created GeoCanvas to combine my
                  interest in mathematics and software
                  development into something practical —
                  a workspace where students and teachers
                  can work with PDFs, annotate problems and
                  use digital geometry instruments.
                </p>
                <p>This Software is built for my Matematics teacher to make the work easier for him
                </p>

              </div>


              <div className="about-info-card">

                <div className="about-card-icon">
                  ⌁
                </div>

                <span className="about-card-label">
                  WHY GEOCANVAS?
                </span>

                <h2>
                  From paper to pixels.
                </h2>

                <p>
                  Mathematics often requires more than
                  simply writing an answer. Rulers,
                  protractors, compasses and geometric
                  constructions are an important part
                  of learning.
                </p>

                <p>
                  GeoCanvas brings these tools together
                  in one digital workspace so mathematical
                  work can be created, annotated, measured
                  and saved directly on a screen.
                </p>

              </div>

            </section>


            {/* =================================================
                FEATURES
                ================================================= */}

            <section className="about-features">

              <div className="about-section-heading">

                <span>
                  THE WORKSPACE
                </span>

                <h2>
                  Everything in one place.
                </h2>

              </div>


              <div className="about-feature-grid">

                <div className="about-feature-card">
                  <small>01</small>

                  <h3>
                    PDF Workspace
                  </h3>

                  <p>
                    Open mathematical worksheets and
                    work directly on top of them.
                  </p>
                </div>


                <div className="about-feature-card">
                  <small>02</small>

                  <h3>
                    Digital Geometry
                  </h3>

                  <p>
                    Use rulers, protractors, compasses,
                    set squares and measurement tools
                    digitally.
                  </p>
                </div>


                <div className="about-feature-card">
                  <small>03</small>

                  <h3>
                    Smart Annotation
                  </h3>

                  <p>
                    Write, highlight, erase and add text
                    using a mouse, touchscreen or stylus.
                  </p>
                </div>


                <div className="about-feature-card">
                  <small>04</small>

                  <h3>
                    Local First
                  </h3>

                  <p>
                    The core workspace is designed around
                    local storage without requiring a
                    backend.
                  </p>
                </div>

              </div>

            </section>


            {/* =================================================
                TECHNOLOGY
                ================================================= */}

            <section className="about-technology">

              <div className="about-tech-heading">

                <span>
                  BUILT WITH
                </span>

                <h2>
                  Simple technology.
                  <br />
                  Practical results.
                </h2>

              </div>


              <div className="about-tech-grid">

                <div>
                  <strong>
                    HTML
                  </strong>

                  <span>
                    Structure
                  </span>
                </div>

                <div>
                  <strong>
                    CSS
                  </strong>

                  <span>
                    Interface
                  </span>
                </div>

                <div>
                  <strong>
                    JavaScript
                  </strong>

                  <span>
                    Interaction
                  </span>
                </div>

                <div>
                  <strong>
                    PDF.js
                  </strong>

                  <span>
                    PDF rendering
                  </span>
                </div>

                <div>
                  <strong>
                    Canvas
                  </strong>

                  <span>
                    Drawing
                  </span>
                </div>

                <div>
                  <strong>
                    TypeScript
                  </strong>

                  <span>
                    Type safety
                  </span>
                </div>

              </div>

            </section>


            {/* =================================================
                LINKS
                ================================================= */}

            <section className="about-links-section">

              <div className="about-links-text">

                <span>
                  EXPLORE MORE
                </span>

                <h2>
                  Want to see what else I build?
                </h2>

                <p>
                  Explore my portfolio, check out my
                  projects and see more of my work beyond
                  GeoCanvas.
                </p>

              </div>


              <div className="about-links">

                <a
                  href="https://muhammad-aayan.netlify.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-profile-link"
                >

                  <div className="profile-link-icon">
                    ↗
                  </div>

                  <div className="profile-link-content">

                    <span>
                      PERSONAL PORTFOLIO
                    </span>

                    <strong>
                      Explore My Portfolio
                    </strong>

                  </div>

                  <div className="profile-link-arrow">
                    →
                  </div>

                </a>


                <a
                  href="https://github.com/codewithaayan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-profile-link"
                >

                  <div className="profile-link-icon">
                    ⌘
                  </div>

                  <div className="profile-link-content">

                    <span>
                      GITHUB
                    </span>

                    <strong>
                      Explore My Code
                    </strong>

                  </div>

                  <div className="profile-link-arrow">
                    →
                  </div>

                </a>

              </div>

            </section>


            {/* =================================================
                DEDICATION
                ================================================= */}

            <section className="about-dedication">

              <span>
                This software is created for
              </span>

              <strong>
                Sir Shamsher Sarfaraz
              </strong>

              <strong>
                O Level Mathematics Teacher
              </strong>

            </section>


            {/* =================================================
                FOOTER
                ================================================= */}

            <footer className="about-footer">


              <footer className="about-footer">
                <div className="about-footer-brand">GEOCANVAS</div>
                <div className="about-footer-text">
                  Built with curiosity, mathematics &amp; code.
                </div>
                <div className="about-footer-rights">
                  © 2026 Muhammad Aayan. All Rights Reserved.
                </div>
              </footer>

            </footer>

          </div>

        </div>
      )}
    </>
  );
}

