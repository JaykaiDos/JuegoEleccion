// chapters.js

module.exports = {
  1: {
    text: "Has descubierto una cueva con extrañas huellas. ¿Atacarás a Deimos directamente o observarás desde lejos?",
    options: [
      { id: 'a', text: "Atacar a Deimos en la cueva", next: 19 }, // Final "El Eco del Silencio" (mala decisión)
      { id: 'b', text: "Retirarse y observar sigilosamente", next: 2 }
    ]
  },

  2: {
    text: "Sigues el rastro de Deimos de noche. ¿Sigues con sigilo o vas con prisa?",
    options: [
      { id: 'a', text: "Seguir con sigilo", next: 3 },
      { id: 'b', text: "Ir con prisa", next: 19 } // Mismo final de derrota por imprudencia
    ]
  },

  3: {
    text: "Encuentras un aldeano atrapado por Deimos. ¿Lo liberas o lo dejas?",
    options: [
      { id: 'a', text: "Liberar al aldeano", next: 4 },
      { id: 'b', text: "Dejarlo atrapado", next: 6 } // Final "Tu Propia Medicina"
    ]
  },

  4: {
    text: "Se dice que la leyenda de la Rata Roja puede ayudar. ¿Crees en la leyenda o no?",
    options: [
      { id: 'a', text: "Creer en la leyenda", next: 5 },
      { id: 'b', text: "No creer en la leyenda", next: 18 } // Final "Eco de la Rata Roja"
    ]
  },

  5: {
    text: "Decides no usar veneno en el enfrentamiento. ¿Preparas una trampa o confrontas directamente?",
    options: [
      { id: 'a', text: "Preparar una trampa", next: 7 },
      { id: 'b', text: "Confrontar directamente", next: 19 } // Mal contraataque -> derrota
    ]
  },

  6: {
    text: "El aldeano atrapado muere sacrificiado en un ritual. Fin trágico.",
    options: []
  },

  7: {
    text: "Deimos queda atrapado en la trampa. ¿Lo matas o lo capturas vivo?",
    options: [
      { id: 'a', text: "Matarlo", next: 8 }, // Final "Rencor de Sangre"
      { id: 'b', text: "Capturarlo vivo", next: 9 }
    ]
  },

  8: {
    text: "Lo mataste en la trampa. Más tarde, un clon de Deimos regresa y amenaza el pueblo.",
    options: []
  },

  9: {
    text: "Durante el ataque de Deimos, debes elegir salvar a Chris (caracol) o a Felore (tamer). ¿A quién ayudas?",
    options: [
      { id: 'a', text: "Salvar a Chris", next: 10 },
      { id: 'b', text: "Salvar a Felore", next: 17 } // Final "Venganza Incompleta"
    ]
  },

  10: {
    text: "Sigues a Deimos bajo tierra. ¿Lo persigues o huyes?",
    options: [
      { id: 'a', text: "Perseguir a Deimos bajo tierra", next: 11 },
      { id: 'b', text: "Huir", next: 12 } // Final "La Rata Indomable"
    ]
  },

  11: {
    text: "Encuentras un mural antiguo. ¿Lo lees para descubrir el origen de Deimos?",
    options: [
      { id: 'a', text: "Leer el mural", next: 13 },
      { id: 'b', text: "Ignorar el mural", next: 14 } // Final "El Silencio de las Ruinas"
    ]
  },

  12: {
    text: "Huiste y Deimos escapa. La plaga se extiende, tu miedo te condena.",
    options: []
  },

  13: {
    text: "Deimos está débil. ¿Lo escuchas y muestras piedad o lo humillas?",
    options: [
      { id: 'a', text: "Escuchar y mostrar piedad", next: 15 },
      { id: 'b', text: "Humillarlo", next: 16 } // Final "Sombra del Pasado"
    ]
  },

  14: {
    text: "Ignoraste el mural y perdiste la clave para vencer a Deimos.",
    options: []
  },

  15: {
    text: "En la guarida final, decides no usar fuego. ¿Aceptas un duelo sin armas?",
    options: [
      { id: 'a', text: "Aceptar duelo sin armas", next: 20 },
      { id: 'b', text: "Rechazar duelo sin armas y usar armas", next: 21 } // Final "La Trampa del Orgullo"
    ]
  },

  16: {
    text: "Deimos, consumido por el odio, se convierte en monstruo imparable.",
    options: []
  },

  17: {
    text: "Salvas a Felore, pero Chris se va y la misión fracasa.",
    options: []
  },

  18: {
    text: "No creíste en la leyenda y mataste a Deimos sin conocer su historia. Otro guardián despierta.",
    options: []
  },

  19: {
    text: "Tu imprudencia te llevó a una derrota inmediata contra Deimos.",
    options: []
  },

  20: {
    text: "Perdonas a Deimos tras el duelo sin armas y lo curas. Él desaparece, pero protege a los pueblos en silencio.",
    options: []
  },

  21: {
    text: "Rechazas el duelo sin armas y usas armas. Deimos te derrota con astucia y fuerza.",
    options: []
  }
}
