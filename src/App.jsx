import React, {
  useState,
  useEffect
} from 'react';

import {
  StoreProvider,
  useStore
} from './state/StoreContext';

import TopBar from './components/TopBar';
import ToolPropertiesBar from './components/ToolPropertiesBar';
import LeftToolbar from './components/LeftToolbar';
import Workspace from './components/Workspace';
import BottomBar from './components/BottomBar';
import SampleDocumentModal from './components/SampleDocumentModal';

function GeoCanvasMain() {
  const {
    undo,
    redo,
    selectTool,
    loadSavedProject
  } = useStore();

  const [
    isSampleModalOpen,
    setIsSampleModalOpen
  ] = useState(false);

  useEffect(() => {
    loadSavedProject();
  }, [loadSavedProject]);

  useEffect(() => {
    const handleKeyDown = e => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();

        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }

        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'y'
      ) {
        e.preventDefault();
        redo();
        return;
      }

      const shortcuts = {
        p: 'pen',
        h: 'highlighter',
        e: 'eraser',
        t: 'text',
        l: 'line',
        c: 'circle',
        r: 'ruler',
        a: 'angle'
      };

      const tool =
        shortcuts[
          e.key.toLowerCase()
        ];

      if (tool) {
        selectTool(tool);
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [
    undo,
    redo,
    selectTool
  ]);

  return (
    <div className="geocanvas-app">

      <TopBar
        onOpenSampleModal={() =>
          setIsSampleModalOpen(true)
        }
      />

      <ToolPropertiesBar />

      <div className="geocanvas-body">

        <LeftToolbar />

        <Workspace />

      </div>

      <BottomBar />

      <SampleDocumentModal
        isOpen={isSampleModalOpen}
        onClose={() =>
          setIsSampleModalOpen(false)
        }
      />

    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <GeoCanvasMain />
    </StoreProvider>
  );
}