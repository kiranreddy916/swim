document.addEventListener("DOMContentLoaded", () => {
    // Register GSAP plugins
    gsap.registerPlugin(ScrollTrigger);

    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas.getContext("2d", { alpha: false }); // Optimize for no transparency
    
    // Total number of generated frames
    const totalFrames1 = 300; // From public/frames
    const totalFrames2 = 240; // From public/frames_3
    const totalFrames = totalFrames1 + totalFrames2; // 540
    const images = new Array(totalFrames);
    let framesLoaded = 0;
    let currentFrameIndex = -1;
    let isExperienceReady = false;
    
    // Performance guardrail: dynamic resolution scaling
    let qualityScale = 1;

    // Detect capabilities and setup canvas resolution
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        
        // If performance drops, qualityScale can be reduced (e.g. 0.75)
        const renderWidth = window.innerWidth * dpr * qualityScale;
        const renderHeight = window.innerHeight * dpr * qualityScale;

        // Only resize if necessary to prevent flicker
        if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
            canvas.width = renderWidth;
            canvas.height = renderHeight;
            // Force re-render on resize
            if (isExperienceReady) {
                renderFrame(Math.max(0, currentFrameIndex));
            }
        }
    }
    
    // Initial size
    resizeCanvas();
    
    // Debounced resize listener
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 100);
    });
    
    // Progressive frame loader
    function preloadFrames() {
        return new Promise((resolve) => {
            let i = 1;
            
            function loadBatch(deadline) {
                while (i <= totalFrames && (deadline.timeRemaining() > 2 || deadline.didTimeout)) {
                    const index = i - 1;
                    const img = new Image();
                    
                    let src;
                    if (i <= totalFrames1) {
                        const numString = i.toString().padStart(3, "0");
                        src = `public/frames/ezgif-frame-${numString}.jpg`;
                    } else {
                        const numString = (i - totalFrames1).toString().padStart(3, "0");
                        src = `public/frames_3/ezgif-frame-${numString}.jpg`;
                    }
                    
                    images[index] = { img, loaded: false };
                    
                    img.onload = () => {
                        images[index].loaded = true;
                        framesLoaded++;
                        
                        // Resolve promise early to start experience quickly
                        if (!isExperienceReady && framesLoaded >= Math.min(10, totalFrames)) {
                            isExperienceReady = true;
                            resolve();
                        }
                        
                        // If we are waiting for this exact frame to render
                        if (isExperienceReady && currentFrameIndex === index) {
                            renderFrame(index);
                        }
                    };
                    
                    img.src = src;
                    i++;
                }
                
                if (i <= totalFrames) {
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(loadBatch, { timeout: 1000 });
                    } else {
                        setTimeout(() => loadBatch({ timeRemaining: () => 10, didTimeout: false }), 10);
                    }
                }
            }
            
            if ('requestIdleCallback' in window) {
                requestIdleCallback(loadBatch, { timeout: 1000 });
            } else {
                setTimeout(() => loadBatch({ timeRemaining: () => 10, didTimeout: false }), 0);
            }
        });
    }

    // High performance render loop
    function renderFrame(index) {
        if (index < 0 || index >= totalFrames) return;
        
        let targetImage = images[index];
        
        // Fallback: Check nearby loaded frames if target is missing
        if (!targetImage || !targetImage.loaded) {
            let found = false;
            // Search expanding outwards from desired index
            for (let offset = 1; offset < 30; offset++) {
                if (images[index - offset] && images[index - offset].loaded) {
                    targetImage = images[index - offset];
                    found = true;
                    break;
                }
                if (images[index + offset] && images[index + offset].loaded) {
                    targetImage = images[index + offset];
                    found = true;
                    break;
                }
            }
            if (!found) return; // Wait for frames to load
        }

        const img = targetImage.img;
        
        // Critical: Always clear canvas before draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Ensure maximum interpolation quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        // Maintain aspect ratio without stretching (cover)
        if (canvasRatio > imgRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / imgRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawWidth = canvas.height * imgRatio;
            drawHeight = canvas.height;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }
        
        // Hardware accelerated draw
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    }
    
    // Core Animation Setup
    function initAnimation() {
        // Fade out loader
        gsap.to("#loader", { 
            opacity: 0, 
            duration: 0.8, 
            ease: "power2.out",
            onComplete: () => {
                document.getElementById("loader").style.display = "none";
            }
        });
        
        // Draw initial frame
        currentFrameIndex = 0;
        renderFrame(0);

        // Define Master Timeline linked to scroll
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: ".ui-overlay",
                start: "top top",
                end: "bottom bottom",
                scrub: 1.5 // 1.5 - 2.5 smoothing per requirements
            }
        });

        // 1. Single Frame Sequence Engine for all 540 frames
        const playhead = { progress: 0 };
        tl.to(playhead, {
            progress: 1,
            duration: 1, 
            ease: "none", 
            onUpdate: () => {
                const targetFrame = Math.floor(playhead.progress * (totalFrames - 1));
                if (targetFrame !== currentFrameIndex) {
                    currentFrameIndex = Math.max(0, Math.min(totalFrames - 1, targetFrame));
                    requestAnimationFrame(() => renderFrame(currentFrameIndex));
                }
            }
        }, 0);

        // 2. Add subtle 3D scale and vertical drift (water resistance feel)
        tl.fromTo("#canvas-container", 
            { scale: 1, y: "0%" },
            { scale: 1.15, y: "6%", duration: 1, ease: "power1.inOut" }, 
        0);
    }
    
    // Start preloading and init
    preloadFrames().then(() => {
        initAnimation();
    });
});
