// Configuración del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Elementos DOM
const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnTTS = document.getElementById('btn-tts');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const accessibleTextEl = document.getElementById('accessible-page-text');

let pageFlip = null;
let pdfDoc = null;
let currentFontSize = 1.6; // rem
let pagesTextContent = []; // Almacena el texto por página para TTS y Accesibilidad

// Reproductor de efectos de sonido usando Web Audio API
function playPageTurnSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.log('Audio Context no permitido aún sin interacción previa.');
    }
}

// Cargar cuento.pdf automáticamente al iniciar
document.addEventListener('DOMContentLoaded', () => {
    loadAutomaticPDF('cuento.pdf');
});

async function loadAutomaticPDF(pdfUrl) {
    loading.style.display = 'block';
    
    try {
        pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        const totalPages = pdfDoc.numPages;
        
        const firstPage = await pdfDoc.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        bookContainer.innerHTML = '';

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Extraer texto para sintetizador de voz y usuarios con baja visión
            const textContent = await page.getTextContent();
            const pageString = textContent.items.map(item => item.str).join(' ');
            pagesTextContent.push(pageString.trim() || `Página ${pageNum}`);

            // Crear canvas para renderizar la imagen de la página
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);
        }

        bookContainer.style.display = 'block';
        
        // Inicializar efecto Flipbook
        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch",
            minWidth: 300,
            maxWidth: pageWidth,
            minHeight: 400,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.5,
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);
        
        loading.style.display = 'none';

        // Evento cuando se cambia de página
        pageFlip.on('flip', (e) => {
            playPageTurnSound();
            updateAccessibleText(e.data);
            
            // Detener lectura en voz alta si estaba leyendo la página anterior
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                btnTTS.classList.remove('reading');
            }
        });

        // Mostrar el texto de la primera página
        updateAccessibleText(0);

    } catch (error) {
        console.error('Error al cargar cuento.pdf:', error);
        loading.innerText = 'No se pudo encontrar o cargar el archivo "cuento.pdf". Asegúrate de tenerlo en el repositorio.';
    }
}

// Actualizar el panel de texto con la página actual
function updateAccessibleText(pageIndex) {
    if (pagesTextContent[pageIndex]) {
        accessibleTextEl.innerText = pagesTextContent[pageIndex];
    } else {
        accessibleTextEl.innerText = `Página ${pageIndex + 1}`;
    }
}

// Botones de navegación Anterior / Siguiente
btnPrev.addEventListener('click', () => {
    if (pageFlip) {
        pageFlip.flipPrev();
    }
});

btnNext.addEventListener('click', () => {
    if (pageFlip) {
        pageFlip.flipNext();
    }
});

// Control de tamaño de letra (Agrandar / Achicar)
btnZoomIn.addEventListener('click', () => {
    if (currentFontSize < 3.0) {
        currentFontSize += 0.2;
        accessibleTextEl.style.fontSize = `${currentFontSize}rem`;
    }
});

btnZoomOut.addEventListener('click', () => {
    if (currentFontSize > 1.0) {
        currentFontSize -= 0.2;
        accessibleTextEl.style.fontSize = `${currentFontSize}rem`;
    }
});

// Lectura en Voz Alta (Text to Speech en Español)
btnTTS.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta la función de lectura en voz alta.');
        return;
    }

    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btnTTS.classList.remove('reading');
        btnTTS.innerText = '🔊 Escuchar Cuento';
        return;
    }

    const currentIdx = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    const textToRead = pagesTextContent[currentIdx] || accessibleTextEl.innerText;

    if (textToRead) {
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'es-ES'; // Idioma Español
        utterance.rate = 0.9;     // Velocidad ligeramente pausada para niños

        utterance.onstart = () => {
            btnTTS.classList.add('reading');
            btnTTS.innerText = '⏹️ Detener Lectura';
        };

        utterance.onend = () => {
            btnTTS.classList.remove('reading');
            btnTTS.innerText = '🔊 Escuchar Cuento';
        };

        window.speechSynthesis.speak(utterance);
    }
});