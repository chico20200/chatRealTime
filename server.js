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
      nombre: nombre || "Anónimo"
    };

    usuarios.set(socket.id, usuario);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));
    io.emit("mensajeSistema", `${usuario.nombre} se conectó`);
  });

  socket.on("mensajeGlobal", (data) => {
    io.emit("mensajeGlobal", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
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