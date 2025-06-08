// chapters.js

module.exports = {
  1: {
    text: "Están en el patio y ven una puerta secreta. ¿Qué hacen?",
    options: [
      { id: 'a', text: "Abrirla con llave antigua", next: 2 },
      { id: 'b', text: "Ignorar y seguir caminando", next: 3 }
    ]
  },
  2: {
    text: "La llave funciona, entran a una biblioteca oculta. ¿Investigan o regresan?",
    options: [
      { id: 'a', text: "Investigar estanterías", next: 4 },
      { id: 'b', text: "Regresar al patio", next: 3 }
    ]
  },
  3: {
    text: "Un guardia aparece y los atrapa. Fin de la aventura.",
    options: []
  },
  4: {
    text: "Encuentran un libro mágico que los transporta a casa. ¡Victoria!",
    options: []
  },

  // Agrega más capítulos aquí...
};
