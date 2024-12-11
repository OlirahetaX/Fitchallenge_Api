require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const { ServerApiVersion, MongoClient } = require("mongodb");
const { initializeApp } = require("firebase/app");
const firebaseAdmin = require("firebase-admin");
const cors = require("cors");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const urlEncodeParser = bodyParser.urlencoded({ extended: true });
const app = express();
app.use(urlEncodeParser);
app.use(cors());
app.options("*", cors());

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.applicationDefault(), // Use service account credentials
});

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
  },
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const port = process.env.PORT || 3000;

const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} = require("firebase/auth");


async function run() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos");
  } catch (error) {
    console.error("Hubo un error al conectarse a la base de datos", error);
  }
}

app.listen(port, () => {
  run();
  console.log("Servidor corriendo en el puerto", port);
});

app.get("/", (req,res) => {
  res.send({
    message:"Fitchallenge",
  })
})

app.post("/createUser", async (req, res) => {
  const auth = getAuth(firebaseApp);
  const email = req.body.correo;
  const password = req.body.contrasena;
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    res.status(200).send({
      descripcion: "usuario creado con exito en firebase",
      result: userCredential,
    });
  } catch (error) {
    res.status(500).send({
      descripcion: "No se pudo crear el usuario en firebase",
      result: error.message || error,
    });
  }
});

app.post("/logIn", async (req, res) => {
  const auth = getAuth(firebaseApp);
  const email = req.body.correo;
  const password = req.body.contrasena;

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    res.status(200).send({
      descripcion: "Sesion iniciada con exito en firebase",
      result: userCredential,
    });
  } catch (error) {
    res.status(500).send({
      descripcion: "No se pudo iniciar sesión en firebase",
      result: error,
    });
  }
});

app.post("/logOut", async (req, res) => {
  const auth = getAuth(firebaseApp);
  try {
    await signOut(auth);
    res.status(200).send({
      descripcion: "Sesion cerrada con exito en firebase",
    });
  } catch (error) {
    res.status(500).send({
      descripcion: "No se pudo cerrar sesión en firebase",
      result: error,
    });
  }
});

app.post("/addUserData", async (req, res) => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const database = client.db("FitChallenge");
    const collection = database.collection("Usuario");

    // Verifica que se envíe un id en la solicitud
    if (!req.body.id) {
      return res.status(400).send({
        mensaje: "El campo 'id' es obligatorio.",
      });
    }
    console.log(req.body.nombre);
    console.log(req.body.apellido);
    // Intentamos insertar el documento con el id proporcionado
    const documento = {
      _id: req.body.id, // Asigna el id recibido en el body como _id
      objetivo: req.body.objetivo,
      edad: req.body.edad,
      genero: req.body.genero,
      peso: req.body.peso,
      experiencia: req.body.experiencia,
      dias_disponibles: req.body.dias_disponibles,
      ubicacion: req.body.ubicacion,
      condicion_fisica: req.body.condicion_fisica,
      tiempo_disponible: req.body.tiempo_disponible,
      nombre: req.body.nombre,
      apellido: req.body.apellido,
      altura: req.body.altura,
      email: req.body.email,
    };

    const resultado = await collection.insertOne(documento);

    res.status(200).send({
      mensaje: "Documento creado con éxito en MongoDB",
      id: resultado.insertedId, // Este debería coincidir con req.body.id
    });

    await client.close();
  } catch (error) {
    if (error.code === 11000) {
      // Código de error 11000 significa duplicado de clave
      return res.status(409).send({
        mensaje: "El ID proporcionado ya existe en la base de datos.",
        error: error.message,
      });
    }

    res.status(500).send({
      mensaje: "No se pudo crear el Documento en MongoDB",
      error: error.message,
    });
  }
});

app.get("/user/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Usuario");

    // Buscar el usuario por ID
    const user = await collection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Error retrieving user:", err);
    res
      .status(500)
      .json({ message: "Error retrieving user", error: err.message });
  }
});

app.get("/checkUser/:uid", async (req, res) => {
  const userUid = req.params.uid;

  try {
    // Conectarte a la base de datos y acceder a la colección
    const database = client.db("FitChallenge"); // Usar la conexión creada con MongoClient
    const collection = database.collection("Usuario");

    // Buscar el usuario por uid (o cualquier campo que corresponda al identificador)
    const user = await collection.findOne({ _id: userUid });

    if (user) {
      return res.status(200).json({ message: "User exists" });
    } else {
      return res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    console.error("Error retrieving user:", err);
    res
      .status(500)
      .json({ message: "Error retrieving user", error: err.message });
  }
});

app.post("/addExercise", async (req, res) => {
  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Ejercicio");

    const { nombre, ubicacion, img, video, categoria } = req.body;

    if (!nombre || !ubicacion || !img || !video || !categoria) {
      return res.status(400).send({
        mensaje:
          "Todos los campos son obligatorios: nombre, ubicacion, img, categoria.",
      });
    }

    // Crear el ejercicio con un _id como cadena
    const ejercicio = {
      _id: new Date().getTime().toString(), // ID único basado en el timestamp
      nombre,
      ubicacion,
      img,
      categoria,
      video,
    };

    const resultado = await collection.insertOne(ejercicio);

    res.status(200).send({
      mensaje: "Ejercicio creado con éxito en MongoDB",
      id: ejercicio._id,
    });
  } catch (error) {
    console.error("Error al guardar el ejercicio:", error);
    res.status(500).send({
      mensaje: "No se pudo guardar el ejercicio en MongoDB",
      error: error.message || error,
    });
  }
});

app.get("/getExercise/:id", async (req, res) => {
  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Ejercicio");

    const { id } = req.params;
    const ejercicio = await collection.findOne({ _id: id });

    if (!ejercicio) {
      return res.status(404).json({
        mensaje: "No se encontró el ejercicio con el ID proporcionado.",
      });
    }

    res.status(200).json(ejercicio);
  } catch (error) {
    console.error("Error al obtener el ejercicio:", error);
    res.status(500).send({
      mensaje: "No se pudo obtener el ejercicio.",
      error: error.message || error,
    });
  }
});

app.get("/getAllExercises", async (req, res) => {
  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Ejercicio");

    const ejercicios = await collection.find({}).toArray();

    res.status(200).send(ejercicios);
  } catch (error) {
    console.error("Error al obtener todos los ejercicios:", error);
    res.status(500).send({
      mensaje: "No se pudieron obtener los ejercicios.",
      error: error.message || error,
    });
  }
});

app.post("/generateRoutine", async (req, res) => {
  try {
    const {
      idUsuario,
      nombre,
      apellido,
      objetivo,
      edad,
      genero,
      peso,
      experiencia,
      dias_disponibles,
      ubicacion,
      condicion_fisica,
      tiempo_disponible,
      altura,
    } = req.body;

    const database = client.db("FitChallenge");
    const collection = database.collection("Ejercicio");
    const ejercicios = await collection.find({}).toArray();

    const ejerciciosList = ejercicios.map((ejercicio) => ({
      idEjercicio: ejercicio._id,
      nombre: ejercicio.nombre,
      categoria: ejercicio.categoria,
      ubicacion: ejercicio.ubicacion,
    }));

    const prompt = `
      Genera una rutina personalizada basada en los siguientes datos del usuario:
      - Nombre: ${nombre} ${apellido}
      - Objetivo: ${objetivo}
      - Edad: ${edad}
      - Género: ${genero}
      - Peso: ${peso} LBS
      - Altura: ${altura} cm
      - Experiencia: ${experiencia}
      - Días disponibles: ${dias_disponibles}
      - Ubicación: ${ubicacion}
      - Complicacion fisica: ${condicion_fisica}
      - Tiempo disponible por sesión: ${tiempo_disponible} minutos

      Ejercicios disponibles:
      ${ejerciciosList
        .map(
          (ex) =>
            `- ${ex.nombre} (ID: ${ex.idEjercicio}, Categoría: ${ex.categoria}, Ubicacion: ${ex.ubicacion})`
        )
        .join("\n")}
      
      Si la hubicacion del usurio dice casa solo usa ejercicios que esten en casa pero si dice gimnasio puedes usar ejercicios de casa y de gimnasio pero preferiblemente de gimnasio.
      Tambien procura no poner ejercicios cualquiera sino que tenga sentido la rutina como por ejemplo no vas a poner hacer pecho dos dias seguidos o hacer todos los musculos un solo dia pero todo depende de la cantidad de tiempo y dias disponibles del usuario.
      Crea los 7 dias de la semana pero solo vas a poner ejercicios en de acuerdo con la cantidad de dias del usuario en los demas dias en el apartado de musculos a trabajar solo ponle Descanso.
      El descanso es en segundos
      La respuesta debe ser exclusivamente un JSON válido con esta estructura:
      {
        "nombre_rutina": string,
        "descripcion": text,
        "nivel": string,
        "objetivo": string,
        "sesiones": [
          {
            "dia": string,
            "musculos": string,
            "ejercicios": [
              { "idEjercicio": string, "series": int, "repeticiones": int (debe ser un número o un rango de números), "descanso": int, "descripcion": text (es una descripción de como hacer el ejercicio), "peso": int (es un peso sugerido para el ejercicio), "terminado": false (Este no lo toques siempre sera false)}
            ]
          }
        ]
      }

      No incluyas texto adicional fuera del JSON. Usa únicamente valores numéricos para "repeticiones", como un rango de repeticiones (por ejemplo, "8-12").
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        `No se encontró un JSON válido en la respuesta de la IA: ${responseText}`
      );
    }

    let routineData;
    try {
      routineData = JSON.parse(jsonMatch[0]);

      routineData.sesiones.forEach((session) => {
        session.ejercicios.forEach((exercise) => {
          if (
            typeof exercise.repeticiones === "string" &&
            exercise.repeticiones === "Máximo"
          ) {
            exercise.repeticiones = 15;
          }
        });
      });
    } catch (parseError) {
      throw new Error(`Error al analizar el JSON: ${parseError.message}`);
    }
    const database2 = client.db("FitChallenge");
    const routinesCollection = database2.collection("Rutina");

    const response = await routinesCollection.insertOne({
      _id: idUsuario,
      ...routineData,
    });

    res.status(200).send({
      message: "Rutina generada y almacenada con éxito",
      rutina: routineData,
      id: response.insertedId,
    });
  } catch (error) {
    console.error("Error al generar la rutina:", error);
    res.status(500).send({
      mensaje: "No se pudo generar la rutina.",
      error: error.message || error,
    });
  }
});

app.get("/getRoutine/:id", async (req, res) => {
  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Rutina");

    const { id } = req.params;
    const rutina = await collection.findOne({ _id: id });

    if (!rutina) {
      return res.status(404).json({
        mensaje: "No se encontró la rutina con el ID proporcionado.",
      });
    }

    res.status(200).json(rutina);
  } catch (error) {
    console.error("Error al obtener la rutina:", error);
    res.status(500).send({
      mensaje: "No se pudo obtener la rutina.",
      error: error.message || error,
    });
  }
});

app.put("/rutina/:idRutina/toggleTerminado/:idEjercicio", async (req, res) => {
  const { idRutina, idEjercicio } = req.params;

  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Rutina");

    const rutina = await collection.findOne({ _id: idRutina });

    if (!rutina) {
      return res.status(404).json({ message: "Rutina no encontrada." });
    }

    let ejercicioEncontrado = null;

    for (const sesion of rutina.sesiones) {
      ejercicioEncontrado = sesion.ejercicios.find(
        (e) => e.idEjercicio === idEjercicio
      );
      if (ejercicioEncontrado) break;
    }

    if (!ejercicioEncontrado) {
      return res.status(404).json({ message: "Ejercicio no encontrado." });
    }

    ejercicioEncontrado.terminado = !ejercicioEncontrado.terminado;

    const result = await collection.updateOne(
      {
        _id: idRutina, // No es necesario convertir a ObjectId si es un string
        "sesiones.ejercicios.idEjercicio": idEjercicio,
      },
      {
        $set: {
          "sesiones.$.ejercicios.$[elem].terminado":
            ejercicioEncontrado.terminado,
        },
      },
      { arrayFilters: [{ "elem.idEjercicio": idEjercicio }] }
    );

    if (result.modifiedCount === 0) {
      console.error("No se actualizó el ejercicio.");
      return res
        .status(400)
        .json({ message: "No se pudo actualizar el ejercicio." });
    }

    res.json({
      message: "Estado del ejercicio actualizado.",
      ejercicio: ejercicioEncontrado,
    });
  } catch (error) {
    console.error("Error al actualizar el estado del ejercicio: ", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

app.get("/getChallenges", async (req, res) => {
  try {
    const database = client.db("FitChallenge");
    const collection = database.collection("Reto");
    const challenges = await collection.find({}).toArray();

    res.status(200).json(challenges);
  } catch (error) {
    console.error("Error al obtener los retos:", error);
    res.status(500).send({ message: "No se pudieron cargar los retos." });
  }
});

app.post("/crearReto", async (req, res) => {
  try {
    console.log("Iniciando el proceso de creación de reto...");
    const {
      idUsuario,
      objetivo,
      edad,
      genero,
      peso,
      experiencia,
      dias_disponibles,
      ubicacion,
      condicion_fisica,
      tiempo_disponible,
      altura,
    } = req.body;

    const fetchPixabayImage = async (nombreEjercicio) => {
      try {
        const query = `${nombreEjercicio} exercise`;
        const response = await axios.get(
          `https://pixabay.com/api/?key=47517999-cd0e11c0cb362a0f64b6b9296&q=${encodeURIComponent(
            query
          )}&image_type=photo`
        );

        const images = response.data.hits;
        if (images.length > 0) {
          const randomIndex = Math.floor(Math.random() * images.length);
          const imageUrl = images[randomIndex].webformatURL;
          return imageUrl;
        } else {
          return "default-image-url.jpg";
        }
      } catch (error) {
        console.error("Error al obtener la imagen de Pixabay:", error);
        return "default-image-url.jpg";
      }
    };

    const database = client.db("FitChallenge");
    const collection = database.collection("Ejercicio");
    const ejercicios = await collection.find({}).toArray();

    const collection2 = database.collection("Reto");
    const retos = await collection2.find({}).toArray();

    const retosList = retos.map((reto) => ({
      nombre_reto: reto.nombre_reto,
      descripcion: reto.descripcion,
      nivel: reto.nivel,
      objetivo: reto.objetivo,
    }));

    const ejerciciosList = ejercicios.map((ejercicio) => ({
      idEjercicio: ejercicio._id,
      nombre: ejercicio.nombre,
      categoria: ejercicio.categoria,
      ubicacion: ejercicio.ubicacion,
      img: ejercicio.img,
    }));

    const prompt = `
      Genera un reto personalizado basado en los siguientes datos del usuario:
      - Objetivo: ${objetivo}
      - Edad: ${edad}
      - Género: ${genero}
      - Peso: ${peso} LBS
      - Altura: ${altura} cm
      - Experiencia: ${experiencia}
      - Días disponibles: ${dias_disponibles}
      - Ubicación: ${ubicacion}
      - Complicación física: ${condicion_fisica}
      - Tiempo disponible por sesión: ${tiempo_disponible} minutos

      Ejercicios disponibles:
      ${ejerciciosList
        .map(
          (ex) =>
            `- ${ex.nombre} (ID: ${ex.idEjercicio}, Categoría: ${ex.categoria}, Ubicación: ${ex.ubicacion})`
        )
        .join("\n")}

      Si la ubicación del usuario dice 'casa', solo usa ejercicios que se puedan hacer en casa. Si dice 'gimnasio', puedes usar ejercicios de casa y de gimnasio, pero preferentemente de gimnasio.
      Asegúrate de crear un reto adecuado a la cantidad de días y tiempo disponibles del usuario. No pongas ejercicios de forma arbitraria, busca que tengan sentido en la rutina. 
      No pongas palabras ni rangos en las repeticiones, siempre pone un número, tampoco valores nulos.
      quiero que te asegures en poner el nombre exactamente como este en la lista de ejercicios dispoibles.
      Asegurate de no ponerle un nombre parecido a los siguientes retos y ponle nombres que tengan que ver con actividad fisica:
      ${retosList
        .map(
          (reto) =>
            `- ${reto.nombre_reto}`
        )
        .join("\n")}

      La respuesta debe ser exclusivamente un JSON válido con esta estructura:
      {
        "nombre_reto": string,
        "descripcion": text,
        "nivel": string,
        "objetivo": string,
        "img": string,
        "sesiones": [
          {
            "dia": string,
            "ejercicios": [
              { "nombre": string, "series": int, "repeticiones": int, "descanso": int, "descripcion": text, "peso": int, "terminado": false }
            ]
          }
        ]
      }

      No incluyas texto adicional fuera del JSON.
    `;


    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();
    const jsonText = responseText.replace(
      /"repeticiones":\s*"Máximo"/g,
      '"repeticiones": 15'
    );    
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        `No se encontró un JSON válido en la respuesta de la IA: ${responseText}`
      );
    }

    let challengeData;
    try {
      challengeData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error al analizar el JSON:", parseError);
      throw new Error(`Error al analizar el JSON: ${parseError.message}`);
    }
    

    const imageUrl = await fetchPixabayImage(challengeData.nombre_reto);
    challengeData.img = imageUrl;

    challengeData.sesiones.forEach((session) => {
      session.ejercicios.forEach((exercise) => {
        const ejercicioBD = ejerciciosList.find(
          (e) => e.nombre.toLowerCase() === exercise.nombre.toLowerCase()
        );

        if (ejercicioBD) {
          exercise.img = ejercicioBD.img || "default-image-url.jpg";
        } else {
          exercise.img = "default-image-url.jpg";
        }
      });
    });

    const routinesCollection = database.collection("Reto");
    const response = await routinesCollection.insertOne({
      ...challengeData,
    });

    res.status(200).send({
      message: "Reto generado y almacenado con éxito",
      reto: challengeData,
      id: response.insertedId,
    });
  } catch (error) {
    console.error("Error al generar el reto:", error);
    res.status(500).send({
      mensaje: "No se pudo generar el reto.",
      error: error.message || error,
    });
  }
});

module.exports = app;
