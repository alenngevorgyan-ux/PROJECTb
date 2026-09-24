/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useWorld } from '../context/WorldContext';
import { Character, Room, Organization } from '../types/world';
import { MapPin, Navigation, ZoomIn, ZoomOut, Compass, Sparkles, Building2, Terminal, ShieldCheck, Mail, ArrowUpRight } from 'lucide-react';

const TILE_SIZE = 36; // Base pixel grid size

export const WorldCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    currentLocation,
    setCurrentLocation,
    characters,
    currentRooms,
    organizations,
    movePlayerTo,
    interactWithCharacter,
    teleportToOrganization,
    activeDialogue,
  } = useWorld();

  const [zoom, setZoom] = useState<number>(1.25);
  const [hoveredChar, setHoveredChar] = useState<Character | null>(null);
  const [hoveredOrg, setHoveredOrg] = useState<Organization | null>(null);
  const [clickTarget, setClickTarget] = useState<{ x: number; y: number; time: number } | null>(null);

  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);
  const cameraRef = useRef<{ x: number; y: number }>({ x: 300, y: 300 });

  // Find founder
  const founder = characters.find((c) => c.id === 'founder');

  // Handle keyboard walking (WASD / Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input is focused or modal open
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (!founder) return;

      let dx = 0;
      let dy = 0;
      const key = e.key.toLowerCase();

      if (key === 'w' || key === 'arrowup') dy = -1;
      else if (key === 's' || key === 'arrowdown') dy = 1;
      else if (key === 'a' || key === 'arrowleft') dx = -1;
      else if (key === 'd' || key === 'arrowright') dx = 1;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const newX = Math.max(1, Math.min(38, founder.x + dx));
        const newY = Math.max(1, Math.min(28, founder.y + dy));
        movePlayerTo(newX, newY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [founder, movePlayerTo]);

  // Click / Tap to move
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert screen coordinates to world tile coordinates
    const camera = cameraRef.current;
    const worldX = (clickX - canvas.width / 2) / zoom + camera.x;
    const worldY = (clickY - canvas.height / 2) / zoom + camera.y;

    const tileX = Math.round(worldX / TILE_SIZE);
    const tileY = Math.round(worldY / TILE_SIZE);

    // Check if clicked directly on a character
    const clickedChar = characters.find(
      (c) => Math.abs(c.x - tileX) <= 1 && Math.abs(c.y - tileY) <= 1 && c.id !== 'founder'
    );

    if (clickedChar) {
      interactWithCharacter(clickedChar.id);
      return;
    }

    // In City mode, check if clicked on a building entrance
    if (currentLocation === 'CITY') {
      const clickedOrg = organizations.find((org) => {
        const b = org.buildingCoords;
        return (
          tileX >= b.x &&
          tileX <= b.x + b.width &&
          tileY >= b.y &&
          tileY <= b.y + b.height + 1
        );
      });

      if (clickedOrg) {
        teleportToOrganization(clickedOrg.id);
        return;
      }
    }

    // Otherwise move player to clicked tile
    setClickTarget({ x: tileX, y: tileY, time: Date.now() });
    movePlayerTo(Math.max(1, Math.min(38, tileX)), Math.max(1, Math.min(26, tileY)));
  };

  // Mouse move hover check
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const camera = cameraRef.current;
    const worldX = (clickX - canvas.width / 2) / zoom + camera.x;
    const worldY = (clickY - canvas.height / 2) / zoom + camera.y;

    const tileX = Math.round(worldX / TILE_SIZE);
    const tileY = Math.round(worldY / TILE_SIZE);

    const foundChar = characters.find(
      (c) => Math.abs(c.x - tileX) <= 0.8 && Math.abs(c.y - tileY) <= 0.8 && c.id !== 'founder'
    );
    setHoveredChar(foundChar || null);

    if (currentLocation === 'CITY') {
      const foundOrg = organizations.find((org) => {
        const b = org.buildingCoords;
        return (
          tileX >= b.x &&
          tileX <= b.x + b.width &&
          tileY >= b.y &&
          tileY <= b.y + b.height
        );
      });
      setHoveredOrg(foundOrg || null);
    } else {
      setHoveredOrg(null);
    }
  };

  // -------------------------------------------------------------
  // PIXEL ART RENDER LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.03;

      // Resize canvas to parent container
      if (containerRef.current) {
        if (
          canvas.width !== containerRef.current.clientWidth ||
          canvas.height !== containerRef.current.clientHeight
        ) {
          canvas.width = containerRef.current.clientWidth;
          canvas.height = containerRef.current.clientHeight;
        }
      }

      // Smooth camera follow target
      const targetX = (founder?.x || 10) * TILE_SIZE;
      const targetY = (founder?.y || 8) * TILE_SIZE;

      cameraRef.current.x += (targetX - cameraRef.current.x) * 0.12;
      cameraRef.current.y += (targetY - cameraRef.current.y) * 0.12;

      ctx.save();
      ctx.imageSmoothingEnabled = false; // Essential for crisp pixel aesthetics!

      // Clear with dark ambient slate
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera transformation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

      // -------------------------------------------------------
      // 1. RENDER BACKGROUND & TILES
      // -------------------------------------------------------
      if (currentLocation === 'CITY') {
        renderCityMap(ctx, time);
      } else {
        renderInteriorMap(ctx, time, currentRooms, currentLocation);
      }

      // -------------------------------------------------------
      // 2. RENDER CLICK TARGET RIPPLE
      // -------------------------------------------------------
      if (clickTarget && Date.now() - clickTarget.time < 1200) {
        const age = (Date.now() - clickTarget.time) / 1200;
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - age})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(clickTarget.x * TILE_SIZE, clickTarget.y * TILE_SIZE, 8 + age * 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(56, 189, 248, ${0.8 - age * 0.8})`;
        ctx.beginPath();
        ctx.arc(clickTarget.x * TILE_SIZE, clickTarget.y * TILE_SIZE, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // -------------------------------------------------------
      // 3. RENDER CHARACTERS
      // -------------------------------------------------------
      // Sort by Y coordinate for depth sorting
      const sortedCharacters = [...characters].sort((a, b) => a.y - b.y);

      sortedCharacters.forEach((char) => {
        // Only draw characters belonging to this location
        const isInCurrentLoc =
          char.id === 'founder' ||
          (currentLocation === 'CITY' && char.currentRoomId === 'CITY') ||
          (currentLocation === 'MY_COMPANY' && char.companyId === 'my-company') ||
          (currentLocation === 'NORTHSTAR' && (char.companyId === 'northstar-design' || (char.id === 'alex-designer' && char.currentRoomId === 'project-apollo-room'))) ||
          (currentLocation === 'ACME' && (char.companyId === 'acme-manufacturing' || (char.id === 'maya' && char.status === 'EN ROUTE'))) ||
          (currentLocation === 'CLOUDWORKS' && char.companyId === 'cloudworks');

        if (isInCurrentLoc) {
          renderCharacter(ctx, char, time, char.id === hoveredChar?.id);
        }
      });

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentLocation, characters, currentRooms, founder, zoom, hoveredChar, clickTarget, organizations]);

  // -------------------------------------------------------------
  // HELPER: RENDER CITY MAP
  // -------------------------------------------------------------
  const renderCityMap = (ctx: CanvasRenderingContext2D, time: number) => {
    const mapWidth = 38 * TILE_SIZE;
    const mapHeight = 24 * TILE_SIZE;

    // Grass / park plazas
    ctx.fillStyle = '#101d24';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Sidewalk tiles
    ctx.fillStyle = '#1a2634';
    for (let x = 0; x < mapWidth; x += TILE_SIZE) {
      for (let y = 0; y < mapHeight; y += TILE_SIZE) {
        if ((x / TILE_SIZE) % 2 === 0 && (y / TILE_SIZE) % 2 === 0) {
          ctx.fillStyle = '#1e2c3c';
        } else {
          ctx.fillStyle = '#162230';
        }
        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }

    // Asphalt Main Boulevards
    // Horizontal central avenue
    ctx.fillStyle = '#0f1722';
    ctx.fillRect(0, 10 * TILE_SIZE, mapWidth, 3 * TILE_SIZE);

    // Vertical central boulevard
    ctx.fillRect(12 * TILE_SIZE, 0, 3 * TILE_SIZE, mapHeight);
    ctx.fillRect(23 * TILE_SIZE, 0, 3 * TILE_SIZE, mapHeight);

    // Road markings (dashed center lines)
    ctx.fillStyle = '#334155';
    for (let x = 0; x < mapWidth; x += TILE_SIZE * 2) {
      ctx.fillRect(x + 8, 11.5 * TILE_SIZE - 2, TILE_SIZE, 4);
    }
    for (let y = 0; y < mapHeight; y += TILE_SIZE * 2) {
      ctx.fillRect(13.5 * TILE_SIZE - 2, y + 8, 4, TILE_SIZE);
      ctx.fillRect(24.5 * TILE_SIZE - 2, y + 8, 4, TILE_SIZE);
    }

    // Street Crosswalks
    ctx.fillStyle = '#475569';
    [10 * TILE_SIZE, 21 * TILE_SIZE].forEach((cx) => {
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(cx + i * 12, 10 * TILE_SIZE, 6, 3 * TILE_SIZE);
      }
    });

    // Streetlamps with soft ambient cones
    const lamps = [
      { x: 2, y: 9.5 },
      { x: 11, y: 9.5 },
      { x: 16, y: 9.5 },
      { x: 22, y: 9.5 },
      { x: 34, y: 9.5 },
      { x: 11.5, y: 2 },
      { x: 11.5, y: 15 },
      { x: 22.5, y: 2 },
      { x: 22.5, y: 15 },
    ];

    lamps.forEach((lamp) => {
      const lx = lamp.x * TILE_SIZE;
      const ly = lamp.y * TILE_SIZE;

      // Lamp glow gradient
      const grad = ctx.createRadialGradient(lx, ly, 4, lx, ly, 42);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lx, ly, 42, 0, Math.PI * 2);
      ctx.fill();

      // Post
      ctx.fillStyle = '#64748b';
      ctx.fillRect(lx - 2, ly - 6, 4, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(lx - 3, ly - 8, 6, 3);
    });

    // Planters & trees
    const trees = [
      { x: 1, y: 2 },
      { x: 1, y: 15 },
      { x: 36, y: 2 },
      { x: 36, y: 15 },
      { x: 14, y: 15 },
      { x: 25, y: 15 },
    ];
    trees.forEach((t) => {
      const tx = t.x * TILE_SIZE;
      const ty = t.y * TILE_SIZE;
      // Planter box
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(tx - 12, ty - 12, 24, 24);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(tx - 12, ty - 12, 24, 24);
      // Foliage
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(tx - 3, ty - 3, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---------------------------------------------------------
    // RENDER BUILDINGS
    // ---------------------------------------------------------
    organizations.forEach((org) => {
      const b = org.buildingCoords;
      const bx = b.x * TILE_SIZE;
      const by = b.y * TILE_SIZE;
      const bw = b.width * TILE_SIZE;
      const bh = b.height * TILE_SIZE;
      const isHovered = hoveredOrg?.id === org.id;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(bx + 8, by + 8, bw, bh);

      // Building Wall Facade
      ctx.fillStyle = org.isVerified ? '#1e293b' : '#271c18';
      ctx.fillRect(bx, by, bw, bh);

      // Building Trim / Border
      ctx.strokeStyle = isHovered ? '#38bdf8' : org.accentColor;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.strokeRect(bx, by, bw, bh);

      // Windows Grid
      const rows = 3;
      const cols = Math.floor(b.width - 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = bx + 16 + c * 28;
          const wy = by + 20 + r * 24;
          // Flickering subtle pixel window glow
          const flicker = Math.sin(time * 2 + c + r) > 0.8;
          ctx.fillStyle = org.isVerified
            ? flicker ? 'rgba(56, 189, 248, 0.65)' : 'rgba(30, 41, 59, 0.8)'
            : flicker ? 'rgba(251, 146, 60, 0.55)' : 'rgba(41, 28, 24, 0.8)';
          ctx.fillRect(wx, wy, 18, 14);
        }
      }

      // Entrance Door
      const doorX = bx + bw / 2 - 20;
      const doorY = by + bh - 24;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(doorX, doorY, 40, 24);
      ctx.strokeStyle = org.accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(doorX, doorY, 40, 24);

      // Entrance glow mat
      ctx.fillStyle = org.isVerified ? 'rgba(56, 189, 248, 0.2)' : 'rgba(251, 146, 60, 0.2)';
      ctx.fillRect(doorX + 2, doorY + 24, 36, 10);

      // Building Header Marquee Bar
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bx + 4, by + 4, bw - 8, 22);

      // Organization Name
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(org.name.toUpperCase(), bx + bw / 2, by + 19);

      // Badge: VERIFIED vs EXTERNAL
      const badgeY = by - 10;
      if (org.isVerified) {
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(bx + bw / 2 - 42, badgeY, 84, 16);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('✓ VERIFIED', bx + bw / 2, badgeY + 11);
      } else {
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(bx + bw / 2 - 58, badgeY, 116, 16);
        ctx.fillStyle = '#ffedd5';
        ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('EXTERNAL / UNCLAIMED', bx + bw / 2, badgeY + 11);
      }

      // Action hint on hover
      if (isHovered) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('CLICK TO ENTER ↵', bx + bw / 2, by + bh + 24);
      }
    });
  };

  // -------------------------------------------------------------
  // HELPER: RENDER INTERIOR MAP
  // -------------------------------------------------------------
  const renderInteriorMap = (
    ctx: CanvasRenderingContext2D,
    time: number,
    rooms: Room[],
    loc: string
  ) => {
    // Outer perimeter floor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 22 * TILE_SIZE, 16 * TILE_SIZE);

    // Draw individual rooms
    rooms.forEach((room) => {
      const rx = room.bounds.x * TILE_SIZE;
      const ry = room.bounds.y * TILE_SIZE;
      const rw = room.bounds.width * TILE_SIZE;
      const rh = room.bounds.height * TILE_SIZE;

      // Room Floor Texture depending on room ID
      if (room.id === 'founder-office') {
        // Executive Parquet Wood Floor
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#292524';
        for (let x = rx; x < rx + rw; x += 16) {
          ctx.fillRect(x, ry, 1, rh);
        }
        for (let y = ry; y < ry + rh; y += 16) {
          ctx.fillRect(rx, y, rw, 1);
        }
      } else if (room.id === 'engineering') {
        // High-tech dark server mesh
        ctx.fillStyle = '#091324';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#112240';
        for (let x = rx; x < rx + rw; x += 12) {
          for (let y = ry; y < ry + rh; y += 12) {
            ctx.fillRect(x + 5, y + 5, 2, 2);
          }
        }
      } else if (room.id === 'design') {
        // Studio Terrazzo
        ctx.fillStyle = '#1e1b2e';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#312e81';
        for (let x = rx + 8; x < rx + rw; x += 24) {
          for (let y = ry + 8; y < ry + rh; y += 24) {
            ctx.fillRect(x, y, 3, 3);
          }
        }
      } else if (room.id === 'procurement') {
        // Industrial logistics tile
        ctx.fillStyle = '#062e24';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#044e39';
        for (let x = rx; x < rx + rw; x += 20) {
          ctx.fillRect(x, ry, 1, rh);
        }
      } else if (room.id === 'finance') {
        // Polished vault mahogany
        ctx.fillStyle = '#271b0c';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = '#452c10';
        ctx.fillRect(rx + 8, ry + 8, rw - 16, rh - 16);
      } else if (room.id === 'meeting-room') {
        // Glass conference carpet
        ctx.fillStyle = '#182438';
        ctx.fillRect(rx, ry, rw, rh);
        // Glass partition border
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
      } else if (room.id === 'server-room') {
        // Datacenter cold tile
        ctx.fillStyle = '#041d1a';
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        // General sleek interior
        ctx.fillStyle = '#131b26';
        ctx.fillRect(rx, ry, rw, rh);
      }

      // Room Wall Outlines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      // Room Name Header Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(rx + 8, ry + 6, rw - 16, 20);
      ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.fillText(room.name.toUpperCase(), rx + 14, ry + 20);

      // Door opening cut-outs
      ctx.fillStyle = '#1e293b';
      const doorX = rx + rw / 2 - 14;
      const doorY = ry + rh - 3;
      ctx.fillRect(doorX, doorY, 28, 6);

      // -------------------------------------------------------
      // ROOM FURNITURE
      // -------------------------------------------------------
      renderRoomFurniture(ctx, room, rx, ry, rw, rh, time);
    });
  };

  // -------------------------------------------------------------
  // HELPER: RENDER ROOM FURNITURE
  // -------------------------------------------------------------
  const renderRoomFurniture = (
    ctx: CanvasRenderingContext2D,
    room: Room,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    time: number
  ) => {
    if (room.id === 'founder-office') {
      // Executive Walnut Desk
      const dx = rx + 3 * TILE_SIZE - 20;
      const dy = ry + 2 * TILE_SIZE - 10;
      ctx.fillStyle = '#451a03';
      ctx.fillRect(dx, dy, 74, 30);
      ctx.strokeStyle = '#78350f';
      ctx.strokeRect(dx, dy, 74, 30);

      // Laptop / monitor
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(dx + 26, dy + 6, 22, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(dx + 27, dy + 7, 20, 10);

      // Executive chair
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dx + 28, dy - 16, 18, 14);

      // Potted Plant
      ctx.fillStyle = '#78350f';
      ctx.fillRect(rx + 16, ry + rh - 30, 16, 16);
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(rx + 24, ry + rh - 30, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (room.id === 'engineering') {
      // Dual-monitor Engineering Workstations
      const dx = rx + 2 * TILE_SIZE - 10;
      const dy = ry + 2 * TILE_SIZE - 10;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(dx, dy, 90, 32);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, 90, 32);

      // Dual Monitors
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(dx + 12, dy + 4, 28, 16);
      ctx.fillRect(dx + 48, dy + 4, 28, 16);

      // Code scrolling simulation on screens
      ctx.fillStyle = '#22c55e';
      const codePulse = (Math.sin(time * 8) + 1) * 0.5;
      ctx.fillRect(dx + 14, dy + 6, 18, 2);
      ctx.fillRect(dx + 14, dy + 10, 24, 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(dx + 50, dy + 6, 22, 2);
      ctx.fillRect(dx + 50, dy + 10, 16 * codePulse, 2);

      // Coffee Mug
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(dx + 80, dy + 18, 6, 6);
    } else if (room.id === 'design') {
      // Design Drafting Table
      const tx = rx + 1.5 * TILE_SIZE;
      const ty = ry + 2 * TILE_SIZE - 8;
      ctx.fillStyle = '#312e81';
      ctx.fillRect(tx, ty, 80, 32);
      ctx.strokeStyle = '#818cf8';
      ctx.strokeRect(tx, ty, 80, 32);

      // Drawing Tablet & Color Swatches
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(tx + 14, ty + 6, 32, 20);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(tx + 54, ty + 6, 6, 6);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(tx + 64, ty + 6, 6, 6);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(tx + 54, ty + 16, 6, 6);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(tx + 64, ty + 16, 6, 6);
    } else if (room.id === 'procurement') {
      // Procurement Logistics Terminal
      const px = rx + 1.5 * TILE_SIZE;
      const py = ry + 2 * TILE_SIZE - 6;
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(px, py, 76, 30);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(px, py, 76, 30);

      // Shipping manifests & scanner
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(px + 12, py + 8, 16, 18);
      ctx.fillStyle = '#022c22';
      ctx.fillRect(px + 40, py + 6, 26, 16);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(px + 42, py + 8, 22, 12);
    } else if (room.id === 'finance') {
      // Treasury Vault Desk
      const fx = rx + 2.5 * TILE_SIZE;
      const fy = ry + 2 * TILE_SIZE - 6;
      ctx.fillStyle = '#451a03';
      ctx.fillRect(fx, fy, 80, 30);
      ctx.strokeStyle = '#f59e0b';
      ctx.strokeRect(fx, fy, 80, 30);

      // Vault Screen
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(fx + 24, fy + 4, 32, 16);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$128.4K', fx + 40, fy + 15);
    } else if (room.id === 'meeting-room') {
      // Executive Conference Boardroom Table
      const mx = rx + rw / 2 - 40;
      const my = ry + rh / 2 - 14;
      ctx.fillStyle = '#334155';
      ctx.fillRect(mx, my, 80, 28);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(mx, my, 80, 28);

      // Chairs around table
      ctx.fillStyle = '#1e293b';
      [-12, 12].forEach((offset) => {
        ctx.fillRect(mx + 16, my + offset + (offset > 0 ? 28 : -8), 12, 8);
        ctx.fillRect(mx + 52, my + offset + (offset > 0 ? 28 : -8), 12, 8);
      });
    } else if (room.id === 'server-room') {
      // Datacenter Server Racks with Blinking LEDs
      const sx = rx + 18;
      const sy = ry + 28;
      for (let i = 0; i < 4; i++) {
        const rackX = sx + i * 36;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rackX, sy, 26, 44);
        ctx.strokeStyle = '#0284c7';
        ctx.strokeRect(rackX, sy, 26, 44);

        // Blinking LEDs
        for (let led = 0; led < 4; led++) {
          const isLedOn = Math.sin(time * 6 + i + led) > 0.1;
          ctx.fillStyle = isLedOn ? (led % 2 === 0 ? '#22c55e' : '#38bdf8') : '#1e293b';
          ctx.fillRect(rackX + 4 + (led % 2) * 10, sy + 8 + Math.floor(led / 2) * 12, 6, 6);
        }
      }
    } else if (room.id === 'project-apollo-room') {
      // Shared Collaboration Table for Alex & Nova
      const cx = rx + rw / 2 - 44;
      const cy = ry + rh / 2 - 12;
      ctx.fillStyle = '#312e81';
      ctx.fillRect(cx, cy, 88, 32);
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, 88, 32);

      // Interactive UI Blueprint display
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx + 20, cy + 5, 48, 22);
      ctx.fillStyle = '#6366f1';
      ctx.font = '600 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('APOLLO V2', cx + 44, cy + 18);
    } else if (room.id === 'acme-comms-room') {
      // Communication Rail Email Terminal
      const ex = rx + rw / 2 - 38;
      const ey = ry + rh / 2 - 12;
      ctx.fillStyle = '#431407';
      ctx.fillRect(ex, ey, 76, 30);
      ctx.strokeStyle = '#ea580c';
      ctx.strokeRect(ex, ey, 76, 30);

      ctx.fillStyle = '#ffedd5';
      ctx.font = '600 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EMAIL RAIL', ex + 38, ey + 18);
    }
  };

  // -------------------------------------------------------------
  // HELPER: RENDER CHARACTER SPRITE
  // -------------------------------------------------------------
  const renderCharacter = (
    ctx: CanvasRenderingContext2D,
    char: Character,
    time: number,
    isHovered: boolean
  ) => {
    const cx = char.x * TILE_SIZE;
    const cy = char.y * TILE_SIZE;

    // Walking bob animation
    const bob = char.isMoving ? Math.sin(time * 14) * 2 : Math.sin(time * 2) * 0.5;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hover ring highlight
    if (isHovered) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Legs / Pants
    ctx.fillStyle = char.pantsColor;
    const legOffset = char.isMoving ? Math.sin(time * 14) * 3 : 0;
    ctx.fillRect(cx - 5, cy + 4 + bob, 4, 8 + legOffset);
    ctx.fillRect(cx + 1, cy + 4 + bob, 4, 8 - legOffset);

    // Torso / Shirt
    ctx.fillStyle = char.shirtColor;
    ctx.fillRect(cx - 7, cy - 7 + bob, 14, 12);

    // Head / Face
    ctx.fillStyle = '#fed7aa'; // Fair skin tone
    ctx.fillRect(cx - 5, cy - 17 + bob, 10, 10);

    // Eyes (direction based)
    ctx.fillStyle = '#0f172a';
    if (char.facing === 'down') {
      ctx.fillRect(cx - 3, cy - 13 + bob, 2, 2);
      ctx.fillRect(cx + 1, cy - 13 + bob, 2, 2);
    } else if (char.facing === 'up') {
      // Facing up, eyes hidden behind hair
    } else if (char.facing === 'left') {
      ctx.fillRect(cx - 4, cy - 13 + bob, 2, 2);
    } else if (char.facing === 'right') {
      ctx.fillRect(cx + 2, cy - 13 + bob, 2, 2);
    }

    // Hair
    ctx.fillStyle = char.hairColor;
    ctx.fillRect(cx - 6, cy - 20 + bob, 12, 5);
    ctx.fillRect(cx - 6, cy - 17 + bob, 3, 5);

    // AI Badge indicator (Small cyan halo if AI agent)
    if (char.type === 'AI') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx + 7, cy - 19 + bob, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name Tag Box
    const nameStr = char.name;
    ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(nameStr).width;
    const tagX = cx - textWidth / 2 - 5;
    const tagY = cy - 30 + bob;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(tagX, tagY, textWidth + 10, 13);
    ctx.strokeStyle = char.type === 'AI' ? 'rgba(56, 189, 248, 0.6)' : 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, textWidth + 10, 13);

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(nameStr, cx, tagY + 9.5);

    // Status Banner / Speech Bubble
    if (char.statusText && char.status !== 'AVAILABLE') {
      const statusStr = char.statusText;
      ctx.font = '500 8px "Plus Jakarta Sans", sans-serif';
      const statusWidth = ctx.measureText(statusStr).width;
      const sTagX = cx - statusWidth / 2 - 6;
      const sTagY = tagY - 14;

      ctx.fillStyle =
        char.status === 'WORKING'
          ? 'rgba(37, 99, 235, 0.95)'
          : char.status === 'WAITING FOR APPROVAL'
          ? 'rgba(217, 119, 6, 0.95)'
          : char.status === 'TALKING'
          ? 'rgba(16, 185, 129, 0.95)'
          : 'rgba(51, 65, 85, 0.95)';

      ctx.fillRect(sTagX, sTagY, statusWidth + 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(statusStr, cx, sTagY + 8.5);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating HUD: Spatial Navigation & Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-md text-xs shadow-lg">
          <MapPin className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-slate-200">
            {currentLocation === 'CITY'
              ? 'District Plaza (City Map)'
              : currentLocation === 'MY_COMPANY'
              ? 'My Company Headquarters'
              : currentLocation === 'NORTHSTAR'
              ? 'Northstar Design (✓ Verified Partner)'
              : currentLocation === 'ACME'
              ? 'Acme Manufacturing (External / Unclaimed)'
              : 'CloudWorks Infrastructure'}
          </span>
        </div>

        {currentLocation !== 'CITY' ? (
          <button
            onClick={() => setCurrentLocation('CITY')}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/60 rounded-md text-xs font-medium transition-all shadow-md active:scale-95"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Exit to City Map</span>
          </button>
        ) : (
          <button
            onClick={() => setCurrentLocation('MY_COMPANY')}
            className="flex items-center gap-1 px-3 py-1.5 bg-sky-600/90 hover:bg-sky-500 text-white border border-sky-400/40 rounded-md text-xs font-medium transition-all shadow-md active:scale-95"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Enter My Company</span>
          </button>
        )}
      </div>

      {/* Zoom and Waypoint Helpers (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-1 rounded-md shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(2.0, z + 0.25))}
          title="Zoom In"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1.25)}
          title="Reset Zoom"
          className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
          title="Zoom Out"
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Keyboard Controls Prompt & Quick Action Tooltip (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-md text-[11px] text-slate-400">
          <span className="font-mono text-slate-300">WASD / Click</span>
          <span>to walk</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-slate-300">Click agent</span>
          <span>to interact</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-slate-300">⌘K</span>
          <span>to teleport</span>
        </div>

        {hoveredChar && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-950/90 border border-sky-600/50 rounded-md text-xs text-sky-200 animate-in fade-in duration-150">
            <span className="font-semibold">{hoveredChar.name}</span>
            <span className="text-sky-400">({hoveredChar.role})</span>
            <span className="text-[10px] bg-sky-500/20 px-1.5 py-0.5 rounded text-sky-300">Click to talk</span>
          </div>
        )}
      </div>

      {/* City Map Quick Buildings Bar (Shown when in CITY view) */}
      {currentLocation === 'CITY' && (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 p-1.5 rounded-md shadow-xl text-xs">
          <span className="text-slate-400 text-[11px] px-2 font-medium">Quick Enter:</span>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => teleportToOrganization(org.id)}
              className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded font-medium transition-colors text-[11px] flex items-center gap-1"
            >
              <span>{org.name}</span>
              {org.isVerified && <span className="text-sky-400 text-[9px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
