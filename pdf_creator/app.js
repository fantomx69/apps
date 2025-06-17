document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURAZIONE DI QUILL.JS
    // Definiamo le opzioni per la barra degli strumenti dell'editor
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }], // Titoli di vario livello
        [{ 'font': [] }],
        ['bold', 'italic', 'underline', 'strike'], // Stili di base
        ['blockquote', 'code-block'], // Blocchi di citazione e codice

        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }], // Liste
        [{ 'indent': '-1'}, { 'indent': '+1' }], // Rientro
        [{ 'direction': 'rtl' }], // Direzione del testo

        [{ 'color': [] }, { 'background': [] }], // Colori
        [{ 'align': [] }], // Allineamento

        ['link', 'image', 'video'], // Inserimento di media

        ['clean'] // Rimuovi formattazione
    ];
    
    // Inizializziamo l'editor Quill
    const quill = new Quill('#editor', {
        modules: {
            toolbar: toolbarOptions
        },
        theme: 'snow', // Tema standard con barra degli strumenti
        placeholder: 'Inizia a scrivere qui il tuo capolavoro...'
    });

    // 2. GESTIONE DELLA SEZIONE FIRMA
    const toggleSignatureBtn = document.getElementById('toggle-signature-btn');
    const signatureSection = document.getElementById('signature-section');
    let isSignatureSectionVisible = false;

    toggleSignatureBtn.addEventListener('click', () => {
        isSignatureSectionVisible = !isSignatureSectionVisible;
        
        if (isSignatureSectionVisible) {
            signatureSection.classList.add('show');
            toggleSignatureBtn.textContent = '📝 Nascondi Firma';
            toggleSignatureBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            toggleSignatureBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        } else {
            signatureSection.classList.remove('show');
            toggleSignatureBtn.textContent = '📝 Mostra Firma';
            toggleSignatureBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            toggleSignatureBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    });

    // 3. SIGNATURE PAD
    const canvas = document.getElementById('signature-pad');
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)', // Sfondo bianco
        penColor: 'rgb(0, 0, 0)' // Penna nera
    });

    // Variabili per la gestione della firma
    let signatureImage = null;
    const signatureStatus = document.getElementById('signature-status');
    const saveSignatureBtn = document.getElementById('save-signature-btn');
    const clearSignatureBtn = document.getElementById('clear-signature-btn');

    // Funzione per salvare la firma
    function saveSignature() {
        if (!signaturePad.isEmpty()) {
            signatureImage = signaturePad.toDataURL('image/png');
            signatureStatus.textContent = '✓ Firma salvata e pronta per l\'esportazione';
            signatureStatus.className = 'text-sm text-green-600 dark:text-green-400';
        } else {
            signatureStatus.textContent = '⚠️ Disegna prima una firma';
            signatureStatus.className = 'text-sm text-yellow-600 dark:text-yellow-400';
        }
    }

    // Funzione per cancellare la firma
    function clearSignature() {
        signaturePad.clear();
        signatureImage = null;
        signatureStatus.textContent = 'Firma cancellata';
        signatureStatus.className = 'text-sm text-gray-600 dark:text-gray-300';
    }

    // Event listeners per i bottoni della firma
    saveSignatureBtn.addEventListener('click', saveSignature);
    clearSignatureBtn.addEventListener('click', clearSignature);

    // 4. LOGICA PER L'ESPORTAZIONE IN PDF (CORRETTA)
    const exportButton = document.getElementById('export-pdf-btn');
    
    exportButton.addEventListener('click', () => {
        const editorContent = document.querySelector('.ql-editor');

        if (!editorContent) {
            console.error("Contenuto dell'editor non trovato!");
            alert("Errore: Impossibile trovare il contenuto da esportare.");
            return;
        }
        
        const originalButtonText = exportButton.textContent;
        exportButton.disabled = true;
        exportButton.textContent = 'Esportazione in corso...';

        // Usiamo il metodo .html() di jsPDF che gestisce automaticamente la paginazione
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // Definizione delle variabili per i margini e le dimensioni
        const marginLeft = 15;
        const marginTop = 15;
        const marginBottom = 15;
        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const contentWidth = pageWidth - (marginLeft * 2);
        
        doc.html(editorContent, {
            // La funzione callback viene eseguita quando la conversione HTML -> PDF è completata
            callback: function(doc) {
                // Aggiungi firma se presente
                if (signatureImage) {
                    // Calcola la posizione per la firma (in basso a destra)
                    const signatureWidth = 40; // mm
                    const signatureHeight = 15; // mm
                    const signatureX = pageWidth - marginLeft - signatureWidth;
                    const signatureY = pageHeight - marginBottom - signatureHeight - 10;
                    
                    // Aggiungi la firma come immagine
                    doc.addImage(signatureImage, 'PNG', signatureX, signatureY, signatureWidth, signatureHeight);
                }
                
                // Salviamo il documento
                doc.save('documento-esportato.pdf');
                
                // Ripristiniamo il bottone
                exportButton.disabled = false;
                exportButton.textContent = originalButtonText;
            },
            // Impostiamo i margini
            x: marginLeft,
            y: marginTop,
            // Definiamo la larghezza del contenuto nel PDF
            width: contentWidth, // Larghezza A4 (210mm) - 2 * margine (15mm)
            windowWidth: editorContent.scrollWidth, // Larghezza dell'elemento sorgente
        
        }).catch((error) => {
            console.error("Errore durante l'esportazione in PDF:", error);
            alert("Si è verificato un errore durante l'esportazione. Controlla la console per i dettagli.");
            // Ripristiniamo il bottone anche in caso di errore
            exportButton.disabled = false;
            exportButton.textContent = originalButtonText;
        });
    });

    // 5. CARICA PDF E MOSTRA TESTO NELL'EDITOR (CORRETTO)
    const pdfFileInput = document.getElementById('pdf-file-input');
    
    pdfFileInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            // Configura PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js';
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
                cMapUrl: 'https://unpkg.com/pdfjs-dist/cmaps/',
                cMapPacked: true
            }).promise;
            
            let extractedText = '';
            
            // Estrai il testo da tutte le pagine
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                // Ricostruisci il testo mantenendo la struttura
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .replace(/\s+/g, ' ') // Normalizza gli spazi
                    .trim();
                
                if (pageText) {
                    extractedText += pageText + '\n\n';
                }
            }
            
            if (extractedText.trim()) {
                quill.setText(extractedText.trim());
                alert(`PDF caricato con successo! Estratto testo da ${pdf.numPages} pagine.`);
            } else {
                alert('PDF caricato ma non è stato trovato testo estraibile. Il PDF potrebbe contenere solo immagini.');
                quill.setText(''); // Pulisce l\'editor
            }
            
        } catch (error) {
            console.error('Errore durante il caricamento del PDF:', error);
            alert(`Errore durante il caricamento del PDF: ${error.message || 'Errore sconosciuto'}`);
        } finally {
            // Reset dell'input per permettere di ricaricare lo stesso file
            event.target.value = '';
        }
    });
});