import React from 'react';

import { useStore } from '../state/StoreContext';

import {
  IconSelect,
  IconPen,
  IconMagicPen,
  IconHighlighter,
  IconLaser,
  IconEraser,
  IconHand,
  IconText,
  IconLine,
  IconCircle,
  IconRuler,
  IconProtractor,
  IconCompass,
  IconSetSquare45,
  IconSetSquare60,
  IconAngle
} from '../assets/math-icons';

// Edit tool icon: dashed frame with corner handles
function IconShapeEdit({ size = 21 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="7" width="14" height="12" strokeDasharray="2.5 2" />
      <rect x="3.2" y="5.2" width="3.6" height="3.6" fill="currentColor" />
      <rect x="17.2" y="5.2" width="3.6" height="3.6" fill="currentColor" />
      <rect x="3.2" y="17.2" width="3.6" height="3.6" fill="currentColor" />
      <rect x="17.2" y="17.2" width="3.6" height="3.6" fill="currentColor" />
      <circle cx="12" cy="2.6" r="1.4" />
      <path d="M12 4v3" />
    </svg>
  );
}

export default function LeftToolbar() {
  const {
    activeTool,
    selectTool
  } = useStore();

  const drawTools = [
    {
      id: 'select',
      name: 'Select & Move',
      icon: IconSelect
    },
    {
      id: 'pan',
      name: 'Hand (Touch Scroll & Pan)',
      icon: IconHand
    },
    {
      id: 'pen',
      name: 'Ink Pen',
      icon: IconPen
    },
    {
      id: 'magicPen',
      name: 'Smart Pen (draw naturally, shapes snap clean)',
      icon: IconMagicPen
    },
    {
      id: 'shapeEdit',
      name: 'Edit Shapes & Ink (move, resize, rotate, recolor)',
      icon: IconShapeEdit
    },
    {
      id: 'laser',
      name: 'Laser Tool (GoodNotes style)',
      icon: IconLaser
    },
    {
      id: 'highlighter',
      name: 'Highlighter',
      icon: IconHighlighter
    },
    {
      id: 'eraser',
      name: 'Stroke Eraser',
      icon: IconEraser
    },
    {
      id: 'text',
      name: 'Math Text',
      icon: IconText
    }
  ];

  const geometryTools = [
    {
      id: 'line',
      name: 'Line Tool',
      icon: IconLine
    },
    {
      id: 'circle',
      name: 'Circle Tool',
      icon: IconCircle
    },
    {
      id: 'ruler',
      name: 'Ruler (cm/mm)',
      icon: IconRuler
    },
    {
      id: 'protractor',
      name: 'Protractor (180°)',
      icon: IconProtractor
    },
    {
      id: 'compass',
      name: 'Drafting Compass',
      icon: IconCompass
    },
    {
      id: 'setSquare45',
      name: '45° Set Square',
      icon: IconSetSquare45
    },
    {
      id: 'setSquare60',
      name: '30° / 60° Set Square',
      icon: IconSetSquare60
    },
    {
      id: 'angle',
      name: 'Measure Angle',
      icon: IconAngle
    }
  ];

  const renderTool =
    tool => {
      const IconComponent =
        tool.icon;

      const isActive =
        activeTool === tool.id;

      return (
        <button
          key={tool.id}

          type="button"

          className={
            `touch-btn tooltip-wrap ${
              isActive
                ? 'active'
                : ''
            }`
          }

          onClick={() =>
            selectTool(tool.id)
          }

          data-tooltip={
            tool.name
          }

          title={tool.name}

          aria-label={
            tool.name
          }

          style={{
            width: '48px',
            height: '44px',
            padding: 0,
            flexShrink: 0
          }}
        >
          <IconComponent
            size={21}
          />
        </button>
      );
    };

  return (
    <aside
      style={{
        width:
          'var(--leftbar-width)',

        minWidth:
          'var(--leftbar-width)',

        background:
          'var(--bg-panel)',

        borderRight:
          '1px solid var(--border-color)',

        display: 'flex',

        flexDirection:
          'column',

        alignItems: 'center',

        padding:
          '10px 0',

        gap: '4px',

        overflowY: 'auto',
        overflowX: 'visible',

        zIndex: 900,

        position: 'relative',

        boxShadow:
          '2px 0 8px rgba(15,23,42,0.04)'
      }}
    >
      <span
        style={{
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          color:
            'var(--math-blue)',
          marginBottom: '4px',
          textTransform:
            'uppercase'
        }}
      >
        Draw
      </span>

      {drawTools.map(
        renderTool
      )}

      <div
        style={{
          width: '36px',
          height: '1px',
          background:
            'var(--border-color)',
          margin: '7px 0'
        }}
      />

      <span
        style={{
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          color:
            'var(--math-cyan)',
          marginBottom: '4px',
          textTransform:
            'uppercase'
        }}
      >
        Geom
      </span>

      {geometryTools.map(
        renderTool
      )}
    </aside>
  );
}