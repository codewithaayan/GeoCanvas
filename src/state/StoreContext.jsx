import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from 'react';

import { loadPdfDocument } from '../pdf/pdfLoader';
import { removePdfPage } from '../pdf/pdfPages';
import {
  saveProjectToDB,
  loadProjectFromDB
} from './db';

import { exportCompletedPdf } from '../pdf/pdfExporter';

import { RulerModel } from '../geometry/Ruler';
import { ProtractorModel } from '../geometry/Protractor';
import { CompassModel } from '../geometry/Compass';
import { SetSquareModel } from '../geometry/SetSquares';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  // =========================================================
  // DOCUMENT
  // =========================================================

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] =
    useState(null);

  const [pdfFileName, setPdfFileName] =
    useState('Blank_Workspace.pdf');

  const [totalPages, setTotalPages] =
    useState(1);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageDimensions, setPageDimensions] =
    useState({
      width: 595.28,
      height: 841.89
    });

  // =========================================================
  // PER-PAGE DATA
  // =========================================================

  const [pages, setPages] = useState({
    1: {
      annotations: [],
      geometryObjects: []
    }
  });

  const [selectedObjectId, setSelectedObjectId] =
    useState(null);

  // Selected ink stroke / smart shape: { id, pageNum } (Edit Shapes tool)
  const [selectedInk, setSelectedInk] =
    useState(null);

  // Always holds the newest pages so history snapshots never depend on
  // side effects inside state updater functions.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  // Latest document state (page count, PDF...) for history snapshots
  const docRef = useRef({});
  docRef.current = {
    totalPages,
    currentPage,
    pdfArrayBuffer,
    pdfDoc
  };

  // =========================================================
  // TOOLS
  // =========================================================

  const [activeTool, setActiveTool] =
    useState('pen');

  const [strokeColor, setStrokeColor] =
    useState('#1d4ed8');

  const [strokeWidth, setStrokeWidth] =
    useState(3);

  const [highlighterColor, setHighlighterColor] =
    useState('#fde047');

  const [highlighterWidth, setHighlighterWidth] =
    useState(24);

  const [highlighterOpacity, setHighlighterOpacity] = useState(0.4);

  const [eraserSize, setEraserSize] =
    useState(16);

  const [snapToTools, setSnapToTools] =
    useState(true);
  // =========================================================
  // APPEARANCE
  // =========================================================

  const [theme, setTheme] =
    useState('paper');

  const [gridType, setGridType] =
    useState('millimeter');

  // =========================================================
  // VIEWPORT
  // =========================================================

  const [zoom, setZoomState] =
    useState(1);

  const [pan, setPan] =
    useState({
      x: 0,
      y: 0
    });

  const [liveCoords, setLiveCoords] =
    useState({
      x: 0,
      y: 0
    });

  // =========================================================
  // STATUS
  // =========================================================

  const [statusMessage, setStatusMessage] =
    useState(null);

  const [isLoading, setIsLoading] =
    useState(false);

  // =========================================================
  // HISTORY
  // =========================================================

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const [canUndo, setCanUndo] =
    useState(false);

  const [canRedo, setCanRedo] =
    useState(false);

  const snapshotPages = () =>
    JSON.parse(
      JSON.stringify(pagesRef.current)
    );

  /*
   * Snapshot of the whole document structure (pages + page count + PDF).
   * Used for operations that change the number of pages, so undo can bring
   * a deleted page back, including its PDF content.
   */
  const snapshotDocument = () => ({
    __doc: true,
    pages: snapshotPages(),
    totalPages: docRef.current.totalPages,
    currentPage: docRef.current.currentPage,
    pdfArrayBuffer: docRef.current.pdfArrayBuffer,
    pdfDoc: docRef.current.pdfDoc
  });

  const restoreEntry = entry => {
    if (entry && entry.__doc) {
      setPages(entry.pages);
      setTotalPages(entry.totalPages);
      setCurrentPage(entry.currentPage);
      setPdfArrayBuffer(entry.pdfArrayBuffer);
      setPdfDoc(entry.pdfDoc);
      setSelectedObjectId(null);
      setSelectedInk(null);
    } else {
      setPages(entry);
    }
  };

  const pushEntry = entry => {
    undoStackRef.current.push(entry);

    if (
      undoStackRef.current.length > 50
    ) {
      undoStackRef.current.shift();
    }

    redoStackRef.current = [];

    setCanUndo(true);
    setCanRedo(false);
  };

  const pushHistory = useCallback(() => {
    pushEntry(snapshotPages());
  }, []);

  const pushDocHistory = useCallback(() => {
    pushEntry(snapshotDocument());
  }, []);

  const undo = useCallback(() => {
    if (
      undoStackRef.current.length === 0
    ) {
      return;
    }

    const previous =
      undoStackRef.current.pop();

    redoStackRef.current.push(
      previous && previous.__doc
        ? snapshotDocument()
        : snapshotPages()
    );

    restoreEntry(previous);

    setCanUndo(
      undoStackRef.current.length > 0
    );

    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (
      redoStackRef.current.length === 0
    ) {
      return;
    }

    const next =
      redoStackRef.current.pop();

    undoStackRef.current.push(
      next && next.__doc
        ? snapshotDocument()
        : snapshotPages()
    );

    restoreEntry(next);

    setCanUndo(true);

    setCanRedo(
      redoStackRef.current.length > 0
    );
  }, []);

  // =========================================================
  // THEME
  // =========================================================

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      theme
    );
  }, [theme]);

  // =========================================================
  // ENSURE PAGE EXISTS
  // =========================================================

  useEffect(() => {
    setPages(prev => {
      if (prev[currentPage]) {
        return prev;
      }

      return {
        ...prev,
        [currentPage]: {
          annotations: [],
          geometryObjects: []
        }
      };
    });
  }, [currentPage]);

  // =========================================================
  // LOAD PDF
  // =========================================================

  const loadPdf = useCallback(
    async (fileOrBuffer, name) => {
      setIsLoading(true);
      setStatusMessage(
        'Loading PDF document...'
      );

      try {
        const result =
          await loadPdfDocument(
            fileOrBuffer,
            name
          );

        setIsLoading(false);

        if (result.success) {
          // Blank workspaces come back with pdfDoc = null (paper + grid
          // are drawn by the app, exactly like before exporting)
          setPdfDoc(result.pdfDoc || null);
          setPdfArrayBuffer(
            result.arrayBuffer || null
          );

          if (result.isBlankWorkspace) {
            if (result.gridType) {
              setGridType(result.gridType);
            }

            if (
              result.theme &&
              ['paper', 'blueprint', 'parchment', 'chalkboard'].includes(result.theme)
            ) {
              setTheme(result.theme);
            }
          }

          setPdfFileName(
            result.fileName
          );

          // A newly opened document starts with a fresh undo history
          undoStackRef.current = [];
          redoStackRef.current = [];
          setCanUndo(false);
          setCanRedo(false);

          setTotalPages(
            result.numPages
          );

          setCurrentPage(1);

          setPageDimensions({
            width: result.naturalWidth,
            height: result.naturalHeight
          });

          if (result.embeddedPagesData) {
            setPages(result.embeddedPagesData);
            setStatusMessage(
              `Loaded "${result.fileName}" with re-editable vector layers!`
            );
          } else {
            const newPages = {};

            for (
              let i = 1;
              i <= result.numPages;
              i++
            ) {
              newPages[i] = {
                annotations: [],
                geometryObjects: []
              };
            }

            setPages(newPages);

            setStatusMessage(
              `Loaded "${result.fileName}" (${result.numPages} pages)`
            );
          }

          undoStackRef.current = [];
          redoStackRef.current = [];

          setCanUndo(false);
          setCanRedo(false);

          setSelectedObjectId(null);

          setTimeout(() => {
            setStatusMessage(null);
          }, 3500);
        } else {
          setStatusMessage(
            result.error
          );
        }
      } catch (error) {
        console.error(error);

        setIsLoading(false);
        setStatusMessage(
          'Unable to load the PDF.'
        );
      }
    },
    []
  );

  // =========================================================
  // ANNOTATIONS
  // =========================================================

  const addAnnotation = useCallback(
    (annotation, targetPage) => {
      pushHistory();

      setPages(prev => {
        const pageNum = targetPage || currentPage;
        const pageData =
          prev[pageNum] || {
            annotations: [],
            geometryObjects: []
          };

        return {
          ...prev,
          [pageNum]: {
            ...pageData,
            annotations: [
              ...pageData.annotations,
              annotation
            ]
          }
        };
      });
    },
    [currentPage, pushHistory]
  );

  /*
   * Change fields of one annotation (colour, width, geometry...).
   * Records one undo step.
   */
  const updateAnnotation = useCallback(
    (id, patch, targetPage) => {
      const pageNum = targetPage || currentPage;

      pushHistory();

      setPages(prev => {
        const pageData = prev[pageNum];
        if (!pageData) return prev;

        return {
          ...prev,
          [pageNum]: {
            ...pageData,
            annotations: pageData.annotations.map(a =>
              a.id === id ? { ...a, ...patch } : a
            )
          }
        };
      });
    },
    [currentPage, pushHistory]
  );

  const removeAnnotation = useCallback(
    (id, targetPage) => {
      const pageNum = targetPage || currentPage;

      pushHistory();

      setPages(prev => {
        const pageData = prev[pageNum];
        if (!pageData) return prev;

        return {
          ...prev,
          [pageNum]: {
            ...pageData,
            annotations: pageData.annotations.filter(a => a.id !== id)
          }
        };
      });
    },
    [currentPage, pushHistory]
  );

  const setPageAnnotations =
    useCallback(
      (newAnnotations, targetPage) => {
        setPages(prev => {
          const pageNum = targetPage || currentPage;
          const pageData =
            prev[pageNum] || {
              annotations: [],
              geometryObjects: []
            };

          return {
            ...prev,
            [pageNum]: {
              ...pageData,
              annotations: newAnnotations
            }
          };
        });
      },
      [currentPage]
    );

  // =========================================================
  // GEOMETRY
  // =========================================================

  const addGeometryObject =
    useCallback(
      (obj, targetPage) => {
        pushHistory();

        setPages(prev => {
          const pageNum = targetPage || currentPage;
          const pageData =
            prev[pageNum] || {
              annotations: [],
              geometryObjects: []
            };

          return {
            ...prev,
            [pageNum]: {
              ...pageData,
              geometryObjects: [
                ...pageData.geometryObjects,
                obj
              ]
            }
          };
        });

        setSelectedObjectId(obj.id);
      },
      [currentPage, pushHistory]
    );

  const updateGeometryObject =
    useCallback(
      (id, updates, targetPage) => {
        setPages(prev => {
          const pageNum = targetPage || currentPage;
          const pageData =
            prev[pageNum] || {
              annotations: [],
              geometryObjects: []
            };

          return {
            ...prev,
            [pageNum]: {
              ...pageData,
              geometryObjects:
                pageData.geometryObjects.map(
                  obj =>
                    obj.id === id
                      ? {
                        ...obj,
                        ...updates
                      }
                      : obj
                )
            }
          };
        });
      },
      [currentPage]
    );

  const removeGeometryObject =
    useCallback(
      (id, targetPage) => {
        pushHistory();

        setPages(prev => {
          const pageNum = targetPage || currentPage;
          const pageData =
            prev[pageNum] || {
              annotations: [],
              geometryObjects: []
            };

          return {
            ...prev,
            [pageNum]: {
              ...pageData,
              geometryObjects:
                pageData.geometryObjects.filter(
                  obj => obj.id !== id
                )
            }
          };
        });

        setSelectedObjectId(
          currentId =>
            currentId === id
              ? null
              : currentId
        );
      },
      [currentPage, pushHistory]
    );

  const clearCurrentPage =
    useCallback((targetPage) => {
      /*
       * Only accept a real page number. The trash button used to pass the
       * click event here, which made the page key "[object Object]" so the
       * visible page was never cleared.
       */
      const pageNum =
        typeof targetPage === 'number' &&
        Number.isFinite(targetPage)
          ? targetPage
          : currentPage;

      const existing =
        pagesRef.current[pageNum];

      const isAlreadyEmpty =
        !existing ||
        (
          (existing.annotations || []).length === 0 &&
          (existing.geometryObjects || []).length === 0
        );

      if (isAlreadyEmpty) {
        setSelectedObjectId(null);
        return;
      }

      pushHistory();

      setPages(prev => ({
        ...prev,
        [pageNum]: {
          annotations: [],
          geometryObjects: []
        }
      }));

      setSelectedObjectId(null);
    }, [currentPage, pushHistory]);

  // =========================================================
  // TOOL SELECTION
  // =========================================================

  const selectTool = useCallback(
    toolId => {
      setActiveTool(toolId);

      // Ink selection only lives inside the Edit Shapes tool
      if (toolId !== 'shapeEdit') {
        setSelectedInk(null);
      }

      if (
        [
          'pen',
          'magicPen',
          'laser',
          'pan',
          'highlighter',
          'eraser',
          'text',
          'line',
          'circle',
          'angle'
        ].includes(toolId)
      ) {
        setSelectedObjectId(null);
      }

      if (
        [
          'ruler',
          'protractor',
          'compass',
          'setSquare45',
          'setSquare60'
        ].includes(toolId)
      ) {
        const pageData =
          pages[currentPage] || {
            geometryObjects: []
          };

        const existing =
          pageData.geometryObjects.find(
            obj =>
              obj.type === toolId
          );

        if (!existing) {
          const cx =
            pageDimensions.width / 2;

          const cy =
            pageDimensions.height / 2;

          let newObj = null;

          if (
            toolId === 'ruler'
          ) {
            newObj =
              RulerModel.createDefault(
                cx,
                cy
              );
          }

          if (
            toolId === 'protractor'
          ) {
            newObj =
              ProtractorModel.createDefault(
                cx,
                cy
              );
          }

          if (
            toolId === 'compass'
          ) {
            newObj =
              CompassModel.createDefault(
                cx,
                cy
              );
          }

          if (
            toolId === 'setSquare45'
          ) {
            newObj =
              SetSquareModel.createDefault45(
                cx,
                cy
              );
          }

          if (
            toolId === 'setSquare60'
          ) {
            newObj =
              SetSquareModel.createDefault60(
                cx,
                cy
              );
          }

          if (newObj) {
            addGeometryObject(
              newObj
            );
          }
        } else {
          setSelectedObjectId(
            existing.id
          );
        }
      }
    },
    [
      currentPage,
      pages,
      pageDimensions,
      addGeometryObject
    ]
  );

  // =========================================================
  // PAGE NAVIGATION
  // =========================================================

  const nextPage = useCallback(() => {
    if (
      currentPage < totalPages
    ) {
      setCurrentPage(
        page => page + 1
      );

      setSelectedObjectId(null);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(
        page => page - 1
      );

      setSelectedObjectId(null);
    }
  }, [currentPage]);

  const addBlankPage =
    useCallback(() => {
      pushDocHistory();

      const newPageNum =
        totalPages + 1;

      setTotalPages(
        newPageNum
      );

      setPages(prev => ({
        ...prev,
        [newPageNum]: {
          annotations: [],
          geometryObjects: []
        }
      }));

      setCurrentPage(
        newPageNum
      );
    }, [totalPages, pushDocHistory]);

  // =========================================================
  // DELETE PAGE
  // =========================================================

  /*
   * Delete a page (default: the current one).
   *  - blank workspace: later pages move up by one
   *  - imported PDF: the page is also removed from the PDF itself
   * One undo step brings the page back with everything on it.
   */
  const deletePage = useCallback(
    async targetPage => {
      const doc = docRef.current;

      const pageNum =
        typeof targetPage === 'number' &&
        Number.isFinite(targetPage)
          ? targetPage
          : doc.currentPage;

      if (doc.totalPages <= 1) {
        return {
          success: false,
          error: 'A document needs at least one page.'
        };
      }

      if (pageNum < 1 || pageNum > doc.totalPages) {
        return {
          success: false,
          error: 'That page does not exist.'
        };
      }

      let nextPdfDoc = doc.pdfDoc;
      let nextPdfBuffer = doc.pdfArrayBuffer;

      // Imported PDF: remove the page from the PDF file as well
      const pdfPageCount = doc.pdfDoc ? doc.pdfDoc.numPages : 0;

      if (doc.pdfDoc && doc.pdfArrayBuffer && pageNum <= pdfPageCount) {
        setIsLoading(true);
        setStatusMessage('Deleting page...');

        try {
          const newBuffer = await removePdfPage(
            doc.pdfArrayBuffer,
            pageNum
          );

          const loaded = await loadPdfDocument(
            newBuffer,
            pdfFileName
          );

          if (!loaded.success) {
            throw new Error(loaded.error || 'Could not reload the PDF.');
          }

          nextPdfDoc = loaded.pdfDoc;
          nextPdfBuffer = loaded.arrayBuffer;
        } catch (err) {
          setIsLoading(false);
          setStatusMessage(null);

          return {
            success: false,
            error: err.message || 'Could not delete this page.'
          };
        }

        setIsLoading(false);
      }

      // One undo step for the whole operation
      pushDocHistory();

      // Pages after the deleted one move up by one
      setPages(prev => {
        const next = {};

        for (let i = 1; i <= doc.totalPages; i++) {
          if (i === pageNum) continue;

          const source = prev[i] || {
            annotations: [],
            geometryObjects: []
          };

          next[i < pageNum ? i : i - 1] = source;
        }

        return next;
      });

      setPdfDoc(nextPdfDoc);
      setPdfArrayBuffer(nextPdfBuffer);

      const newTotal = doc.totalPages - 1;

      setTotalPages(newTotal);
      setCurrentPage(Math.min(pageNum, newTotal));

      setSelectedObjectId(null);
      setSelectedInk(null);

      setStatusMessage(`Deleted page ${pageNum}`);

      setTimeout(() => {
        setStatusMessage(null);
      }, 2500);

      return { success: true, newTotal };
    },
    [pdfFileName, pushDocHistory]
  );

  // =========================================================
  // ZOOM
  // =========================================================

  const setZoom = useCallback(z => {
    setZoomState(
      Math.max(
        0.3,
        Math.min(3, Number(z))
      )
    );
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState(z =>
      Math.min(
        3,
        Number(
          (z + 0.25).toFixed(2)
        )
      )
    );
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState(z =>
      Math.max(
        0.4,
        Number(
          (z - 0.25).toFixed(2)
        )
      )
    );
  }, []);

  /*
   * The workspace now handles page centering
   * through normal document flow and scrolling.
   * fitPage therefore only calculates the zoom.
   */

  const fitPage = useCallback(
    (
      viewportWidth,
      viewportHeight
    ) => {
      if (
        !viewportWidth ||
        !viewportHeight
      ) {
        setZoomState(1);
        setPan({
          x: 0,
          y: 0
        });
        return;
      }

      const horizontalPadding = 64;
      const verticalPadding = 64;

      const scaleX =
        (viewportWidth -
          horizontalPadding) /
        pageDimensions.width;

      const scaleY =
        (viewportHeight -
          verticalPadding) /
        pageDimensions.height;

      const fitScale =
        Math.min(
          scaleX,
          scaleY,
          1.5
        );

      const newZoom =
        Number(
          Math.max(
            0.4,
            fitScale
          ).toFixed(2)
        );

      setZoomState(newZoom);

      setPan({
        x: 0,
        y: 0
      });
    },
    [pageDimensions]
  );

  // =========================================================
  // SAVE
  // =========================================================

  const saveProject =
    useCallback(async () => {
      setStatusMessage(
        'Saving project locally...'
      );

      const res =
        await saveProjectToDB({
          pdfArrayBuffer,
          pdfFileName,
          totalPages,
          currentPage,
          pages,
          pageDimensions,

          settings: {
            theme,
            gridType,
            strokeColor,
            strokeWidth,
            highlighterColor,
            highlighterWidth,
            highlighterOpacity,
            eraserSize
          }
        });

      if (res.success) {
        setStatusMessage(
          'Project saved successfully!'
        );
      } else {
        setStatusMessage(
          'Failed to save project: ' +
          res.error
        );
      }

      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    }, [
      pdfArrayBuffer,
      pdfFileName,
      totalPages,
      currentPage,
      pages,
      pageDimensions,
      theme,
      gridType,
      strokeColor,
      strokeWidth,
      highlighterColor,
      highlighterWidth,
      highlighterOpacity,
      eraserSize
    ]);

  // =========================================================
  // LOAD SAVED PROJECT
  // =========================================================

  const loadSavedProject =
    useCallback(async () => {
      setIsLoading(true);
      setStatusMessage(
        'Checking for saved projects...'
      );

      const saved =
        await loadProjectFromDB();

      setIsLoading(false);

      if (saved) {
        if (
          saved.pdfArrayBuffer
        ) {
          await loadPdf(
            saved.pdfArrayBuffer,
            saved.pdfFileName
          );
        }

        setPages(
          saved.pages || {}
        );

        setTotalPages(
          saved.totalPages || 1
        );

        setCurrentPage(
          saved.currentPage || 1
        );

        if (
          saved.pageDimensions
        ) {
          setPageDimensions(
            saved.pageDimensions
          );
        }

        if (saved.settings) {
          if (
            saved.settings.theme
          ) {
            setTheme(
              saved.settings.theme
            );
          }

          if (
            saved.settings.gridType
          ) {
            setGridType(
              saved.settings.gridType
            );
          }

          if (
            saved.settings.strokeColor
          ) {
            setStrokeColor(
              saved.settings.strokeColor
            );
          }

          if (
            saved.settings.strokeWidth
          ) {
            setStrokeWidth(
              saved.settings.strokeWidth
            );
          }

          if (
            saved.settings.highlighterColor
          ) {
            setHighlighterColor(
              saved.settings.highlighterColor
            );
          }

          if (
            saved.settings.highlighterWidth
          ) {
            setHighlighterWidth(
              saved.settings.highlighterWidth
            );
          }

          if (
            saved.settings.highlighterOpacity !==
            undefined
          ) {
            setHighlighterOpacity(
              saved.settings.highlighterOpacity
            );
          }

          if (
            saved.settings.eraserSize
          ) {
            setEraserSize(
              saved.settings.eraserSize
            );
          }
        }

        setStatusMessage(
          'Loaded saved project'
        );

        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);

        return true;
      }

      setStatusMessage(
        'No saved project found.'
      );

      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);

      return false;
    }, [loadPdf]);

  // =========================================================
  // EXPORT
  // =========================================================

  const exportPdf =
    useCallback(async () => {
      setIsLoading(true);

      setStatusMessage(
        'Generating Solved_Mathematics.pdf...'
      );

      const res =
        await exportCompletedPdf({
          pdfArrayBuffer,
          pagesData: pages,
          totalPages,
          defaultDimensions:
            pageDimensions,
          gridType,
          theme
        });

      setIsLoading(false);

      if (res.success) {
        setStatusMessage(
          'Exported Solved_Mathematics.pdf successfully!'
        );
      } else {
        setStatusMessage(
          res.error
        );
      }

      setTimeout(() => {
        setStatusMessage(null);
      }, 3500);
    }, [
      pdfArrayBuffer,
      pages,
      totalPages,
      pageDimensions,
      gridType,
      theme
    ]);

  // =========================================================
  // CURRENT PAGE
  // =========================================================

  const currentPageData =
    pages[currentPage] || {
      annotations: [],
      geometryObjects: []
    };

  // =========================================================
  // PROVIDER
  // =========================================================

  return (
    <StoreContext.Provider
      value={{
        // Document
        pdfDoc,
        pdfFileName,
        totalPages,
        currentPage,
        setCurrentPage,
        pageDimensions,
        currentPageData,
        pages,
        loadPdf,
        nextPage,
        prevPage,
        addBlankPage,
        deletePage,

        // Tools
        activeTool,
        selectTool,

        selectedObjectId,
        setSelectedObjectId,

        selectedInk,
        setSelectedInk,

        strokeColor,
        setStrokeColor,

        strokeWidth,
        setStrokeWidth,

        highlighterColor,
        setHighlighterColor,

        highlighterWidth,
        setHighlighterWidth,

        highlighterOpacity,
        setHighlighterOpacity,

        eraserSize,
        setEraserSize,

        snapToTools,
        setSnapToTools,

        // Actions
        addAnnotation,
        updateAnnotation,
        removeAnnotation,
        setPageAnnotations,

        addGeometryObject,
        updateGeometryObject,
        removeGeometryObject,

        clearCurrentPage,

        // History
        pushHistory,
        undo,
        redo,
        canUndo,
        canRedo,

        // Viewport
        zoom,
        setZoom,
        zoomIn,
        zoomOut,
        fitPage,

        pan,
        setPan,

        liveCoords,
        setLiveCoords,

        // Appearance
        theme,
        setTheme,

        gridType,
        setGridType,

        // Persistence
        saveProject,
        loadSavedProject,
        exportPdf,

        // Status
        statusMessage,
        setStatusMessage,
        isLoading
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context =
    useContext(StoreContext);

  if (!context) {
    throw new Error(
      'useStore must be used within a StoreProvider'
    );
  }

  return context;
}