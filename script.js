/* ==========================================================================
   CINEMATIC WORKSTATION PORTFOLIO INTERACTIVITY
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initNoiseCanvas();
  initCustomCursor();
  initTimecodes();
  initWaveformAnimation();
  initModalController();
  initScrollTracker();
  initMagneticElements();
  initScrollReveal();
  initTimelineScrubber();
});

/* --- 1. Canvas-based Film Grain & Voltage Flicker --- */
function initNoiseCanvas() {
  const canvas = document.getElementById("noise-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Create an offscreen canvas with static grain to save CPU cycles
  const grainSize = 150;
  const grainCanvas = document.createElement("canvas");
  grainCanvas.width = grainSize;
  grainCanvas.height = grainSize;
  const grainCtx = grainCanvas.getContext("2d");
  const grainData = grainCtx.createImageData(grainSize, grainSize);

  function generateGrainPattern() {
    const buffer = new Uint32Array(grainData.data.buffer);
    for (let i = 0; i < buffer.length; i++) {
      const val = Math.floor(Math.random() * 255);
      // Grayscale noise + alpha
      buffer[i] = (val << 24) | (val << 16) | (val << 8) | 20; // very subtle opacity (20/255)
    }
    grainCtx.putImageData(grainData, 0, 0);
  }

  generateGrainPattern();

  // Rendering loop
  let lastTime = 0;
  function render(time) {
    requestAnimationFrame(render);

    // Cap frame rate of grain to ~24fps for cinematic feel
    if (time - lastTime < 41) return;
    lastTime = time;

    ctx.clearRect(0, 0, width, height);

    // Draw grain pattern at random offsets
    const xOffset = Math.random() * grainSize;
    const yOffset = Math.random() * grainSize;

    ctx.fillStyle = ctx.createPattern(grainCanvas, "repeat");
    ctx.save();
    ctx.translate(xOffset, yOffset);
    ctx.fillRect(-xOffset, -yOffset, width, height);
    ctx.restore();

    // Occasional Voltage Flicker (simulate CRT monitor pulse)
    if (Math.random() > 0.98) {
      ctx.fillStyle = `rgba(217, 255, 0, ${Math.random() * 0.02})`; // faint yellow flash
      ctx.fillRect(0, 0, width, height);
    }
  }

  requestAnimationFrame(render);
}

/* --- 2. Custom Magnetic Cursor --- */
function initCustomCursor() {
  const cursor = document.getElementById("custom-cursor");
  
  // Disable completely on touch devices for better performance
  if (window.matchMedia("(pointer: coarse)").matches) {
    if (cursor) cursor.style.display = 'none';
    return;
  }
  
  const ring = cursor.querySelector(".cursor-ring");
  const dot = cursor.querySelector(".cursor-dot");

  let mouse = { x: 0, y: 0 };
  let cursorDotPos = { x: 0, y: 0 };
  let cursorRingPos = { x: 0, y: 0 };

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Smooth lerp function
  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  // Animation frame
  function updateCursor() {
    // Dot is fast
    cursorDotPos.x = lerp(cursorDotPos.x, mouse.x, 0.25);
    cursorDotPos.y = lerp(cursorDotPos.y, mouse.y, 0.25);

    // Ring lags behind (gives smooth feel)
    cursorRingPos.x = lerp(cursorRingPos.x, mouse.x, 0.12);
    cursorRingPos.y = lerp(cursorRingPos.y, mouse.y, 0.12);

    cursor.style.left = `${cursorDotPos.x}px`;
    cursor.style.top = `${cursorDotPos.y}px`;

    // Position the ring relative to the cursor coordinates
    const dx = cursorRingPos.x - cursorDotPos.x;
    const dy = cursorRingPos.y - cursorDotPos.y;
    ring.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    requestAnimationFrame(updateCursor);
  }
  requestAnimationFrame(updateCursor);

  // Add Hover Classes to Body
  const hoverInteractives = document.querySelectorAll(
    "a, button, .cta-circle-btn, .modal-close-btn, .header-logo, .track-block"
  );
  hoverInteractives.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      if (el.classList.contains("playground-cta-btn") || el.closest("#play-sticky-card")) {
        document.body.classList.add("hover-purple");
      } else {
        document.body.classList.add("hover-interactive");
      }
    });
    el.addEventListener("mouseleave", () => {
      document.body.classList.remove("hover-interactive");
      document.body.classList.remove("hover-purple");
    });
  });

  // Watch Trailer triggers get custom label cursor
  const playTriggers = document.querySelectorAll(
    ".monitor-screen, .watch-trailer-btn, .work-card"
  );
  playTriggers.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      document.body.classList.add("hover-play");
    });
    el.addEventListener("mouseleave", () => {
      document.body.classList.remove("hover-play");
    });
  });
}

/* --- 3. Dynamic Timecode Systems --- */
function initTimecodes() {
  const terminalClock = document.getElementById("terminal-timecode-live");
  const monitorTimecodeMain = document.getElementById("monitor-timecode-main");
  const workTimecode = document.getElementById("work-section-timecode");

  // A. Live console timecode (synced with actual clock HH:MM:SS:FF)
  function updateLiveTimecode() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");

    // Calculate frames (0-23) based on milliseconds
    const ms = now.getMilliseconds();
    const frames = String(Math.floor((ms / 1000) * 24)).padStart(2, "0");

    if (terminalClock) {
      terminalClock.textContent = `${hrs}:${mins}:${secs}:${frames}`;
    }
    requestAnimationFrame(updateLiveTimecode);
  }
  requestAnimationFrame(updateLiveTimecode);

  // B. Main Monitor Timecode (playback counter loops 00:01:18:24)
  let monitorFrame = 0;
  function updateMonitorTimecode() {
    monitorFrame++;
    if (monitorFrame >= 1884) { // loop at 01:18:12 (1884 frames)
      monitorFrame = 0;
    }

    if (monitorTimecodeMain) {
      monitorTimecodeMain.textContent = framesToTimecode(monitorFrame);
    }
    setTimeout(updateMonitorTimecode, 1000 / 24); // 24 FPS
  }
  updateMonitorTimecode();

  // C. Selected Work timecode changes on project hover
  const workCards = document.querySelectorAll(".work-card");
  let workInterval = null;
  let workFrame = 0;

  workCards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      // Clear existing counters
      clearInterval(workInterval);

      // Parse duration from metadata (e.g. "03:26" or "00:60")
      const durationText = card.querySelector(".work-duration").textContent;
      const parts = durationText.split(":");
      const maxSeconds = parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : 60;
      const maxFrames = maxSeconds * 24;

      workFrame = 0;
      workInterval = setInterval(() => {
        workFrame += 3; // speed up counting effect
        if (workFrame >= maxFrames) {
          workFrame = 0;
        }
        if (workTimecode) {
          workTimecode.textContent = framesToTimecode(workFrame);
        }
      }, 1000 / 24);
    });

    card.addEventListener("mouseleave", () => {
      clearInterval(workInterval);
      if (workTimecode) {
        workTimecode.textContent = "00:00:02:15"; // default reset
      }
    });
  });
}

// Convert frame integer into HH:MM:SS:FF
function framesToTimecode(totalFrames) {
  const fps = 24;
  const secValue = Math.floor(totalFrames / fps);
  const frames = String(totalFrames % fps).padStart(2, "0");
  const hrs = String(Math.floor(secValue / 3600)).padStart(2, "0");
  const mins = String(Math.floor((secValue % 3600) / 60)).padStart(2, "0");
  const secs = String(secValue % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}:${frames}`;
}

/* --- 4. Live Audio Waveform (SVG path drawing) --- */
function initWaveformAnimation() {
  const path = document.getElementById("audio-wave-path");
  if (!path) return;

  let phase = 0;
  function animateWave() {
    phase += 0.12;
    let points = [];
    const width = 100;
    const height = 20;
    const step = 2;

    for (let x = 0; x <= width; x += step) {
      // Combined mathematical sine waves for complex organic shape
      const angle = (x / width) * Math.PI * 4 + phase;
      const modifier = Math.sin((x / width) * Math.PI); // pin wave edges to zero
      const y = 10 + Math.sin(angle) * 5 * modifier + Math.cos(angle * 1.5) * 3 * modifier;
      points.push(`${x},${y}`);
    }

    path.setAttribute("d", "M" + points.join(" L"));
    requestAnimationFrame(animateWave);
  }
  animateWave();
}

/* --- 5. Video/Trailer Fullscreen Monitor Modal --- */
function initModalController() {
  const modal = document.getElementById("trailer-modal");
  const closeBtn = document.getElementById("modal-close-trigger");
  const watchFeaturedBtn = document.getElementById("watch-trailer-trigger");
  const watchMonitorScreen = document.querySelector(".monitor-screen");
  const workCards = document.querySelectorAll(".work-card");

  const modalTitle = document.getElementById("modal-project-title");
  const modalStill = document.getElementById("modal-video-still-img");
  const modalVideoPlayer = document.getElementById("modal-video-player");
  const modalYoutubePlayer = document.getElementById("modal-youtube-player");
  const modalTimecodeEl = document.getElementById("modal-timecode");
  const playPauseBtn = document.getElementById("modal-play-pause");
  const glitchBtn = document.getElementById("modal-glitch-trigger");
  const snowOverlay = document.getElementById("modal-noise-snow");
  const modalBufferingIndicator = document.getElementById("modal-buffering-indicator");

  let isPlaying = true;
  let modalFrame = 0;
  let modalTimer = null;

  let audioCtx = null;
  let analyser = null;
  let audioSource = null;
  let spectrumData = null;
  let spectrumAnimId = null;
  const spectrumBars = modal.querySelectorAll(".spectrum-bar");

  function initAudioVisualizer() {
    if (audioCtx) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    try {
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      
      audioSource = audioCtx.createMediaElementSource(modalVideoPlayer);
      audioSource.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      spectrumData = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn("Audio Context init failed:", e);
    }
  }

  function animateSpectrum() {
    if (!analyser || !isPlaying) return;
    
    analyser.getByteFrequencyData(spectrumData);
    
    for (let i = 0; i < 6; i++) {
      const val = spectrumData[i * 3 + 2] || 0;
      const height = Math.max(2, (val / 255) * 14);
      spectrumBars[i].style.height = `${height}px`;
    }
    
    spectrumAnimId = requestAnimationFrame(animateSpectrum);
  }

  function openModal(title, sourceSrc) {
    modal.classList.add("active");
    modalTitle.textContent = `CLIP PREVIEW // ${title.toUpperCase()}`;
    
    const isVideo = sourceSrc.toLowerCase().endsWith(".mp4");
    const isYoutube = sourceSrc.includes("youtube.com") || sourceSrc.includes("youtu.be");
    
    if (isVideo) {
      modalStill.style.display = "none";
      if(modalYoutubePlayer) {
        modalYoutubePlayer.style.display = "none";
        modalYoutubePlayer.src = "";
      }
      modalVideoPlayer.style.display = "block";
      modalVideoPlayer.src = sourceSrc;
      modalVideoPlayer.muted = false;
      modalVideoPlayer.currentTime = 0;
      
      initAudioVisualizer();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      modalVideoPlayer.play().then(() => {
        spectrumBars.forEach(bar => bar.style.animation = "none");
        cancelAnimationFrame(spectrumAnimId);
        animateSpectrum();
      }).catch(err => {
        console.warn("Unmuted autoplay failed, trying muted:", err);
        modalVideoPlayer.muted = true;
        modalVideoPlayer.play();
      });
    } else if (isYoutube) {
      modalStill.style.display = "none";
      modalVideoPlayer.style.display = "none";
      modalVideoPlayer.pause();
      modalVideoPlayer.src = "";
      
      if(modalYoutubePlayer) {
        modalYoutubePlayer.style.display = "block";
        modalYoutubePlayer.src = sourceSrc;
      }
      
      spectrumBars.forEach(bar => {
        bar.style.animation = "";
        bar.style.height = "";
      });
      cancelAnimationFrame(spectrumAnimId);
    } else {
      modalStill.style.display = "block";
      modalVideoPlayer.style.display = "none";
      if(modalYoutubePlayer) {
        modalYoutubePlayer.style.display = "none";
        modalYoutubePlayer.src = "";
      }
      modalVideoPlayer.src = "";
      modalStill.src = sourceSrc;
      
      spectrumBars.forEach(bar => {
        bar.style.animation = "";
        bar.style.height = "";
      });
      cancelAnimationFrame(spectrumAnimId);
    }
    
    isPlaying = true;
    playPauseBtn.textContent = "PAUSE";
    modalFrame = 0;

    // Start playback simulation
    startModalPlayback(isVideo);

    // Add visual CRT glitch pulse on entry
    triggerModalGlitch(isVideo);
  }

  function closeModal() {
    modal.classList.remove("active");
    clearInterval(modalTimer);
    if (modalVideoPlayer) {
      modalVideoPlayer.pause();
      modalVideoPlayer.src = "";
    }
    if (modalYoutubePlayer) {
      modalYoutubePlayer.src = "";
    }
    cancelAnimationFrame(spectrumAnimId);
    spectrumBars.forEach(bar => {
      bar.style.animation = "";
      bar.style.height = "";
    });
  }

  function startModalPlayback(isVideo) {
    clearInterval(modalTimer);
    modalTimer = setInterval(() => {
      if (isPlaying) {
        if (isVideo && modalVideoPlayer) {
          modalFrame = Math.floor(modalVideoPlayer.currentTime * 24);
        } else {
          modalFrame++;
        }
        modalTimecodeEl.textContent = framesToTimecode(modalFrame);
      }
    }, 1000 / 24);
  }

  function triggerModalGlitch(isVideo) {
    snowOverlay.style.opacity = "0.7";
    const targetElement = isVideo ? modalVideoPlayer : modalStill;
    if (targetElement) {
      targetElement.style.filter = "invert(1) hue-rotate(90deg) contrast(150%)";
    }

    setTimeout(() => {
      snowOverlay.style.opacity = "0";
      if (targetElement) {
        targetElement.style.filter = "none";
      }
    }, 200);

    // Secondary micro flickering
    setTimeout(() => {
      snowOverlay.style.opacity = "0.2";
      setTimeout(() => {
        snowOverlay.style.opacity = "0";
      }, 50);
    }, 400);
  }

  // Bind Events
  watchFeaturedBtn.addEventListener("click", () => {
    openModal("Warped (Featured)", "/assets/vids/warped_featured.mp4");
  });

  watchMonitorScreen.addEventListener("click", () => {
    openModal("Warped (Featured)", "/assets/vids/warped_featured.mp4");
  });

  workCards.forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.querySelector(".work-title").textContent;
      let sourceSrc = card.querySelector(".work-image").src;
      
      const videoAttr = card.getAttribute("data-video");
      if (videoAttr && (videoAttr.endsWith(".mp4") || videoAttr.includes("youtube.com"))) {
        sourceSrc = videoAttr;
      }

      openModal(title, sourceSrc);
    });
  });

  /* --- Buffering Events --- */
  if (modalVideoPlayer) {
    modalVideoPlayer.addEventListener("waiting", () => {
      modalBufferingIndicator.style.display = "flex";
    });
    modalVideoPlayer.addEventListener("loadstart", () => {
      modalBufferingIndicator.style.display = "flex";
    });
    modalVideoPlayer.addEventListener("playing", () => {
      modalBufferingIndicator.style.display = "none";
    });
    modalVideoPlayer.addEventListener("canplay", () => {
      modalBufferingIndicator.style.display = "none";
    });
  }

  // Bind close events
  closeBtn.addEventListener("click", closeModal);

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Modal Play/Pause toggler
  playPauseBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? "PAUSE" : "PLAY";

    const isVideo = modalVideoPlayer && modalVideoPlayer.src && modalVideoPlayer.style.display !== "none";
    if (isVideo) {
      if (isPlaying) {
        modalVideoPlayer.play().then(() => {
          if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
          cancelAnimationFrame(spectrumAnimId);
          animateSpectrum();
        }).catch(err => console.log(err));
      } else {
        modalVideoPlayer.pause();
        cancelAnimationFrame(spectrumAnimId);
      }
    }

    // Toggle play indicator
    const stateEl = modal.querySelector(".play-state-indicator");
    if (isPlaying) {
      stateEl.innerHTML = `<span class="play-triangle">▶</span> PLAYING`;
      stateEl.style.borderLeftColor = "var(--accent-lime)";
    } else {
      stateEl.innerHTML = `❚❚ PAUSED`;
      stateEl.style.borderLeftColor = "var(--accent-lavender)";
    }
  });

  // Manual Glitch injection
  glitchBtn.addEventListener("click", () => {
    const isVideo = modalVideoPlayer && modalVideoPlayer.src;
    triggerModalGlitch(isVideo);
  });

  // Click on video to toggle play/pause
  if (modalVideoPlayer) {
    modalVideoPlayer.addEventListener("click", () => {
      playPauseBtn.click();
    });
  }
}

/* --- 6. Scroll Tracker & Navigation Progress --- */
function initScrollTracker() {
  const nodes = document.querySelectorAll(".scroll-bar-node");
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section[id]");

  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;

    // Toggle nodes based on scroll percentage
    const activeIndex = Math.min(
      Math.floor(scrollPercent * nodes.length),
      nodes.length - 1
    );

    nodes.forEach((node, idx) => {
      if (idx <= activeIndex) {
        node.classList.add("active");
      } else {
        node.classList.remove("active");
      }
    });

    // Highlight nav links on scroll (Scroll Spy)
    let currentActiveId = "";
    sections.forEach((sec) => {
      const top = sec.offsetTop - 180;
      const height = sec.offsetHeight;
      if (scrollTop >= top && scrollTop < top + height) {
        currentActiveId = sec.getAttribute("id");
      }
    });

    if (currentActiveId) {
      navLinks.forEach((link) => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${currentActiveId}`) {
          link.classList.add("active");
        }
      });
    }
  });
}

/* --- 7. Magnetic Button Logic --- */
function initMagneticElements() {
  const magnets = document.querySelectorAll(".cta-circle-btn, .radar-btn-container");

  magnets.forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Pull element slightly (20% of distance)
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;

      // If it's the sonar radar button, tilt core
      const core = el.querySelector(".sonar-core");
      if (core) {
        core.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px) scale(1.1)`;
      }
    });

    el.addEventListener("mouseleave", () => {
      el.style.transform = "translate(0px, 0px)";
      const core = el.querySelector(".sonar-core");
      if (core) {
        core.style.transform = "translate(0px, 0px) scale(1)";
      }
    });
  });
}

/* --- 8. Scroll Reveal Observer --- */
function initScrollReveal() {
  const revealElements = document.querySelectorAll(".reveal-on-scroll");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");

          // If it's the about section, start the stat counter
          if (entry.target.id === "about") {
            startStatsCounter();
          }
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => observer.observe(el));
}

/* --- 9. Process Timeline Scrubber --- */
function initTimelineScrubber() {
  const blocks = document.querySelectorAll(".track-block");
  const playhead = document.getElementById("timeline-playhead-bar");
  const sectionTimecode = document.getElementById("process-section-timecode");
  const gridContainer = document.querySelector(".timeline-grid");
  const timelineContainer = document.querySelector(".timeline-container");
  
  if (!blocks.length || !playhead || !gridContainer || !timelineContainer) return;
  
  let playheadPos = 0;
  let scrubbing = true;
  let animFrameId = null;
  let isVisible = false;

  function animatePlayhead() {
    if (!isVisible) {
      animFrameId = requestAnimationFrame(animatePlayhead);
      return;
    }
    
    if (scrubbing) {
      playheadPos += 0.00111; 
      if (playheadPos > 1) {
        playheadPos = 0;
      }
    }
    
    const gridRect = gridContainer.getBoundingClientRect();
    const trackWidth = gridRect.width - 140; 
    const currentLeft = 140 + (playheadPos * trackWidth);
    
    // Revert to reliable style.left for exact positioning
    playhead.style.left = `${currentLeft}px`;
    
    // Update timecode text dynamically
    const totalSeconds = playheadPos * 90;
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    const frames = Math.floor((playheadPos * 90 * 24) % 24).toString().padStart(2, '0');
    if (sectionTimecode) sectionTimecode.textContent = `00:${mins}:${secs}:${frames}`;

    // Check which block is currently under the playhead
    let activeBlock = null;
    const playheadX = gridRect.left + currentLeft;
    
    blocks.forEach(block => {
      const blockRect = block.getBoundingClientRect();
      if (playheadX >= blockRect.left - 5 && playheadX <= blockRect.right + 5) {
        activeBlock = block;
      }
    });
    
    if (activeBlock) {
      if (!activeBlock.classList.contains("active")) {
        blocks.forEach(b => b.classList.remove("active"));
        activeBlock.classList.add("active");
      }
    } else {
      blocks.forEach(b => b.classList.remove("active"));
    }
    
    // --- Auto-Scroll Logic for Mobile View ---
    if (timelineContainer && window.innerWidth <= 900 && scrubbing) {
      const playheadScreenX = currentLeft - timelineContainer.scrollLeft;
      const rightThreshold = timelineContainer.clientWidth / 2;
      
      if (playheadPos < 0.002) {
        timelineContainer.scrollLeft = 0;
      } else if (playheadScreenX > rightThreshold) {
        timelineContainer.scrollLeft += (playheadScreenX - rightThreshold) * 0.15;
      }
    }
    
    animFrameId = requestAnimationFrame(animatePlayhead);
  }
  
  // Intersection Observer to pause animation when off-screen
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      isVisible = entry.isIntersecting;
    });
  }, { rootMargin: "100px" });
  
  observer.observe(timelineContainer);
  
  // Start the animation loop
  animatePlayhead();


  // --- Drag and Drop Logic for Clips ---
  let isDraggingBlock = false;
  let dragActiveBlock = null;
  let dragStartX = 0;
  let initialGridStart = 0;
  let trackSpan = 0;
  let colWidth = 0;

  blocks.forEach(block => {
    block.addEventListener("mousedown", (e) => {
      if (window.innerWidth <= 900) return; // Only allow drag on desktop
      
      isDraggingBlock = true;
      dragActiveBlock = block;
      dragStartX = e.clientX;
      
      const computed = window.getComputedStyle(block);
      initialGridStart = parseInt(computed.gridColumnStart, 10) || 1;
      let initialGridEnd = parseInt(computed.gridColumnEnd, 10) || (initialGridStart + 4);
      trackSpan = initialGridEnd - initialGridStart;
      
      const trackContainer = block.closest(".track-blocks");
      if (trackContainer) {
        colWidth = trackContainer.getBoundingClientRect().width / 12;
      } else {
        colWidth = 50; // Fallback
      }
      
      document.body.style.userSelect = "none";
      block.style.zIndex = "100";
      block.style.cursor = "grabbing";
      block.style.animationPlayState = "paused";
      
      e.stopPropagation(); // Stop click from scrubbing
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingBlock || !dragActiveBlock) return;
    
    scrubbing = false; // Prevent playhead jump
    
    const deltaX = e.clientX - dragStartX;
    const colsMoved = Math.round(deltaX / colWidth);
    
    let newStart = initialGridStart + colsMoved;
    let newEnd = newStart + trackSpan;
    
    // Clamp within the 12-column grid
    if (newStart < 1) {
      newStart = 1;
      newEnd = newStart + trackSpan;
    }
    if (newEnd > 13) {
      newEnd = 13;
      newStart = newEnd - trackSpan;
    }
    
    dragActiveBlock.style.gridColumn = `${newStart} / ${newEnd}`;
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingBlock && dragActiveBlock) {
      dragActiveBlock.style.zIndex = "";
      dragActiveBlock.style.cursor = "pointer";
      dragActiveBlock.style.animationPlayState = "";
    }
    isDraggingBlock = false;
    dragActiveBlock = null;
    document.body.style.userSelect = "";
    scrubbing = true;
  });
}

/* --- 10. Statistics Counter Animation --- */
let statsAnimated = false;
function startStatsCounter() {
  if (statsAnimated) return;
  statsAnimated = true;

  const numbers = document.querySelectorAll(".stat-number");
  numbers.forEach((num) => {
    const target = parseInt(num.getAttribute("data-val"), 10);
    let current = 0;
    const duration = 1500; // ms
    const stepTime = Math.max(Math.floor(duration / target), 10);

    const counter = setInterval(() => {
      current += Math.ceil(target / 45); // increment steps
      if (current >= target) {
        current = target;
        clearInterval(counter);
      }
      num.textContent = current;
    }, stepTime);
  });
}

/* --- 12. Vertical Videos Force Play --- */
/* --- 12. Vertical Videos Play-On-Hover & Sync --- */
function initVerticalVideos() {
  const vWrappers = document.querySelectorAll('.v-video-wrapper');
  const isMobile = window.innerWidth <= 900;
  
  vWrappers.forEach(wrapper => {
    const videos = wrapper.querySelectorAll('video');
    const label = wrapper.querySelector('.v-video-label');
    if (videos.length < 2) return;
    
    const baseVid = videos[0];
    const hoverVid = videos[1];

    if (isMobile) {
      // The videos are hidden by CSS on mobile (replaced by images). Ensure they are paused to save resources.
      baseVid.pause();
      hoverVid.pause();
      return; // Skip hover logic on mobile
    }

    // Force strict loop based on the SHORTER of the two videos to prevent freezing if exports have mismatched lengths
    baseVid.addEventListener('timeupdate', () => {
      const minDuration = Math.min(baseVid.duration || 999, hoverVid.duration || 999);
      
      // Sync the graded video to the ungraded video to prevent desync
      if (baseVid.currentTime < minDuration && Math.abs(baseVid.currentTime - hoverVid.currentTime) > 0.3) {
        hoverVid.currentTime = baseVid.currentTime;
      }
      
      // Force loop if near the end of the shortest video
      if (minDuration !== 999 && baseVid.currentTime >= minDuration - 0.1) {
        baseVid.currentTime = 0;
        hoverVid.currentTime = 0;
        baseVid.play().catch(()=>{});
        hoverVid.play().catch(()=>{});
      }
    });

    // Play both videos when hovering over the card
    wrapper.addEventListener('mouseenter', () => {
      baseVid.play().catch(e => console.log("Autoplay prevented:", e));
      hoverVid.play().catch(e => console.log("Autoplay prevented:", e));
    });
    
    // Pause both videos when removing hover to save resources
    wrapper.addEventListener('mouseleave', () => {
      baseVid.pause();
      hoverVid.pause();
    });
  });
}

initVerticalVideos();

/* --- 13. NLE Work Experience Timeline Reveal --- */
function initExperienceTimeline() {
  const rows = document.querySelectorAll('.nle-job-row');
  if (rows.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.2 });

  rows.forEach(row => {
    row.style.opacity = 0;
    row.style.transform = 'translateY(30px)';
    row.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(row);
  });
}

initExperienceTimeline();

/* --- 14. Mobile Menu Toggle --- */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const overlay = document.getElementById('mobile-menu');
  const mobileLinks = document.querySelectorAll('.mobile-link');
  
  if (!menuBtn || !overlay) return;

  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    overlay.classList.toggle('active');
    
    // Prevent scrolling when menu is open
    document.body.style.overflow = overlay.classList.contains('active') ? 'hidden' : '';
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      menuBtn.classList.remove('open');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

initMobileMenu();
