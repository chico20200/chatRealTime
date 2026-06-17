const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const usuarios = new Map();

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando" });
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("registrarUsuario", (nombre) => {
    const usuario = {
      id: socket.id,
      nombre: nombre || "Anónimo",
      sala: null
    };

    usuarios.set(socket.id, usuario);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));
    io.emit("mensajeSistema", `${usuario.nombre} se conectó`);
  });

   socket.on("entrarSala", (nombreSala) => {
    const usuario = usuarios.get(socket.id);
    if (!usuario) return;

    // Si ya estaba en otra sala, la abandona primero
    if (usuario.sala) {
      socket.leave(usuario.sala);
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} salió de la sala`);
    }

    socket.join(nombreSala);
    usuario.sala = nombreSala;
    usuarios.set(socket.id, usuario);

    io.to(nombreSala).emit("mensajeSistema", `${usuario.nombre} entró en la sala "${nombreSala}"`);
    io.emit("usuariosActualizados", Array.from(usuarios.values()));
  });

  socket.on("salirSala", () => {
    const usuario = usuarios.get(socket.id);
    if (!usuario || !usuario.sala) return;

    const salaAnterior = usuario.sala;
    socket.leave(salaAnterior);
    usuario.sala = null;
    usuarios.set(socket.id, usuario);

    io.to(salaAnterior).emit("mensajeSistema", `${usuario.nombre} salió de la sala`);
    io.emit("usuariosActualizados", Array.from(usuarios.values()));
  });


  socket.on("mensajeGlobal", (data) => {
    const usuario = usuarios.get(socket.id);
    const mensaje = {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    };

    if (usuario?.sala) {
      io.to(usuario.sala).emit("mensajeGlobal", mensaje);
    } else {
      io.emit("mensajeGlobal", mensaje);
    }
  });

  socket.on("mensajePrivado", (data) => {
    io.to(data.destinoId).emit("mensajePrivado", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

 socket.on("disconnect", () => {
    const usuario = usuarios.get(socket.id);

    // 👇 MODIFICADO: avisar a la sala si estaba en una
    if (usuario?.sala) {
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} se desconectó`);
    }

    usuarios.delete(socket.id);
    io.emit("usuariosActualizados", Array.from(usuarios.values()));

    if (usuario) {
      io.emit("mensajeSistema", `${usuario.nombre} se desconectó`);
    }

    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});