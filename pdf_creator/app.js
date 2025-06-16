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

            // 2. LOGICA PER L'ESPORTAZIONE IN PDF
            const exportButton = document.getElementById('export-pdf-btn');
            
            exportButton.addEventListener('click', () => {
                // Selezioniamo il contenuto dell'editor. Quill crea una classe .ql-editor.
                const editorContent = document.querySelector('.ql-editor');

                if (!editorContent) {
                    console.error("Contenuto dell'editor non trovato!");
                    alert("Errore: Impossibile trovare il contenuto da esportare.");
                    return;
                }

                // Messaggio di feedback per l'utente
                const originalButtonText = exportButton.textContent;
                exportButton.disabled = true;
                exportButton.textContent = 'Esportazione in corso...';
                
                // Usiamo html2canvas per creare un'immagine (canvas) del contenuto HTML
                html2canvas(editorContent, { 
                    scale: 2, // Aumenta la scala per una migliore risoluzione nel PDF
                    useCORS: true // Permette di caricare immagini da altre origini
                }).then(canvas => {
                    // Creiamo una nuova istanza di jsPDF
                    // `window.jspdf.jsPDF` è il modo corretto per accedere all'oggetto dopo averlo importato via CDN
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({
                        orientation: 'p', // portrait (verticale)
                        unit: 'mm', // unità di misura
                        format: 'a4' // formato A4
                    });

                    const imgData = canvas.toDataURL('image/png');
                    
                    // Calcoliamo le dimensioni dell'immagine per adattarla alla pagina A4
                    const imgWidth = 210; // Larghezza A4 in mm
                    const pageHeight = 297; // Altezza A4 in mm
                    const imgHeight = canvas.height * imgWidth / canvas.width;
                    let heightLeft = imgHeight;

                    let position = 0;

                    // Aggiungiamo l'immagine al PDF
                    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                    
                    // Se il contenuto è più lungo di una pagina, creiamo nuove pagine
                    while (heightLeft > 0) {
                        position = heightLeft - imgHeight;
                        doc.addPage();
                        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                    
                    // Salviamo il file PDF
                    doc.save('documento-esportato.pdf');

                }).catch(error => {
                    console.error("Errore durante la creazione del PDF:", error);
                    alert("Si è verificato un errore durante l'esportazione. Controlla la console per i dettagli.");
                }).finally(() => {
                    // Ripristiniamo il bottone allo stato originale
                    exportButton.disabled = false;
                    exportButton.textContent = originalButtonText;
                });
            });
        });