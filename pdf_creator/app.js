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

            // Signature Pad
            var canvas = document.getElementById('signature-pad');
            var signaturePad = new SignaturePad(canvas);

            // Salva la firma come immagine
            var signatureImage = null;
            function saveSignature() {
                if (!signaturePad.isEmpty()) {
                    signatureImage = signaturePad.toDataURL('image/png');
                    alert('Firma salvata!');
                }
            }
            function clearSignature() {
                signaturePad.clear();
                signatureImage = null;
            }

            // 2. LOGICA PER L'ESPORTAZIONE IN PDF (MODIFICATA E CORRETTA)
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
                
                doc.html(editorContent, {
                    // La funzione callback viene eseguita quando la conversione HTML -> PDF è completata
                    callback: function(doc) {
                        // Aggiungi firma se presente
                        if (signatureImage) {
                            // Posiziona la firma in fondo al testo
                            doc.addImage(signatureImage, 'PNG', marginLeft, pageHeight - marginBottom - 3, 6, 2);
                        }
                        
                        // Salviamo il documento
                        doc.save('documento-esportato.pdf');
                        
                        // Ripristiniamo il bottone
                        exportButton.disabled = false;
                        exportButton.textContent = originalButtonText;
                    },
                    // Impostiamo i margini
                    x: 15,
                    y: 15,
                    // Definiamo la larghezza del contenuto nel PDF
                    width: 170, // Larghezza A4 (210mm) - 2 * margine (15mm)
                    windowWidth: editorContent.scrollWidth, // Larghezza dell'elemento sorgente
                
                }).catch((error) => {
                    console.error("Errore durante l'esportazione in PDF:", error);
                    alert("Si è verificato un errore durante l'esportazione. Controlla la console per i dettagli.");
                    // Ripristiniamo il bottone anche in caso di errore
                    exportButton.disabled = false;
                    exportButton.textContent = originalButtonText;
                });
            });

            // Carica PDF e mostra testo nell’editor
            async function loadPDF(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                
                reader.onload = async function() {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
                    let text = '';
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map(item => item.str).join(' ') + '\n';
                    }
                    quill.setText(text);
                };
                reader.readAsArrayBuffer(file);
            }
        });