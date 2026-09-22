// Edita solo este archivo para cambiar textos, fotos, música y datos de la fiesta.
window.INV = {
  nombre: 'Ashley',

  // 05 de marzo de 2027, 9:00 PM hora de Perú (UTC-5) = 06 mar 02:00 UTC
  fechaISO: '2027-03-06T02:00:00Z',
  fechaTexto: 'Viernes 05 de marzo de 2027',
  hora: '9:00 PM',

  lugarNombre: '',                                   // opcional: nombre del local o salón
  direccion: 'Urb. Vive Hogar Mz B5, Lt 32',
  ciudad: 'Castilla, Piura, Perú',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=-5.150344,-80.497974', // coordenadas exactas del local

  fraseApertura: 'Con la bendición de Dios y el cariño de mi familia, quiero celebrar contigo el inicio de una nueva etapa.',

  yapeNumero: '9XX XXX XXX',                         // <-- tu número de Yape
  yapeNombre: '',                                    // opcional: nombre del titular

  musica: 'assets/musica.mp3',                       // <-- coloca tu MP3 en public/assets/
  fotos: {
    portada: 'assets/portada.jpg',                   // <-- foto principal (vertical)
    galeria: [
      'assets/foto1.jpg', 'assets/foto2.jpg', 'assets/foto3.jpg',
      'assets/foto4.jpg', 'assets/foto5.jpg', 'assets/foto6.jpg'
    ]
  }
};
