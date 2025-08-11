const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');

// Variables de entorno (se configuran en Render)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GOOGLE_SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN no configurado');
  process.exit(1);
}

console.log('🚀 Iniciando bot de Discord en Render.com...');

// Cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// SERVIDOR WEB PARA RENDER
// =========================
const app = express();

// Middleware
app.use(express.json());

// Rutas para keep-alive
app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot funcionando en Render.com',
    user: client.user?.tag || 'Conectando...',
    guilds: client.guilds?.cache.size || 0,
    uptime: Math.floor(process.uptime()),
    platform: 'Render.com',
    timestamp: new Date().toISOString(),
    limaTime: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    ready: client.isReady()
  });
});

app.get('/health', (req, res) => {
  const isReady = client.isReady();
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'healthy' : 'connecting',
    bot: isReady ? 'connected' : 'disconnected',
    user: client.user?.tag || null,
    latency: isReady ? client.ws.ping : null,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => {
  res.json({ 
    ping: 'pong', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    bot: client.user?.tag || 'Connecting...'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Servidor web activo en puerto ${PORT}`);
  console.log(`🔗 Render URL disponible para keep-alive`);
});

// =========================
// EVENTOS DEL BOT
// =========================

client.once('ready', () => {
  console.log('='*60);
  console.log('✅ BOT CONECTADO EXITOSAMENTE');
  console.log(`👤 Usuario: ${client.user.tag}`);
  console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
  console.log(`📊 Google Sheets: ${GOOGLE_SHEETS_WEBHOOK_URL ? '✅ Configurado' : '❌ No configurado'}`);
  console.log(`🌐 Platform: Render.com`);
  console.log(`⏰ Hora Lima: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
  console.log('='*60);
  
  // Establecer actividad del bot
  client.user.setActivity('Control de Asistencia 24/7 | Render.com', { 
    type: 'WATCHING' 
  });
});

// Comandos de mensaje
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase().trim();
  
  // Comando setup
  if (content === '!setup' || content === '!setup_attendance') {
    if (!message.member?.permissions.has('Administrator')) {
      return message.reply('❌ Se requieren permisos de administrador para usar este comando.');
    }
    
    try {
      await setupAttendancePanel(message);
      console.log(`✅ Panel configurado por ${message.author.username} en ${message.guild.name}`);
    } catch (error) {
      console.error('❌ Error en setup:', error);
      message.reply('❌ Error configurando el panel. Verifica los logs.').catch(() => {});
    }
  }
  
  // Comando status
  if (content === '!status') {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📊 Estado del Sistema de Asistencia')
        .setDescription('🚀 **Funcionando en Render.com**')
        .setColor(0x00ff00)
        .addFields([
          { name: '🤖 Bot', value: `✅ ${client.user.tag}`, inline: true },
          { name: '🏠 Servidores', value: `${client.guilds.cache.size}`, inline: true },
          { name: '🔗 Latencia', value: `${client.ws.ping}ms`, inline: true },
          { name: '⏰ Uptime', value: `${Math.floor(client.uptime / 1000)}s`, inline: true },
          { name: '📊 Google Sheets', value: GOOGLE_SHEETS_WEBHOOK_URL ? '✅ Configurado' : '❌ No configurado', inline: true },
          { name: '🌐 Plataforma', value: 'Render.com', inline: true }
        ])
        .setFooter({ text: '🚀 Siempre activo en Render' })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Error en status:', error);
      message.reply('❌ Error mostrando estado.').catch(() => {});
    }
  }
  
  // Comando ping
  if (content === '!ping') {
    const start = Date.now();
    try {
      const msg = await message.reply('🏓 Calculando latencia...');
      const latency = Date.now() - start;
      await msg.edit(`🏓 **Pong!**\n**Latencia:** ${latency}ms\n**WebSocket:** ${client.ws.ping}ms\n**Plataforma:** Render.com`);
    } catch (error) {
      console.error('❌ Error en ping:', error);
    }
  }
});

// Manejo de interacciones (botones y modales)
client.on('interactionCreate', async (interaction) => {
  try {
    console.log(`🎯 Interacción recibida: ${interaction.type} - ${interaction.customId || 'none'} de ${interaction.user.username}`);
    
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
    
  } catch (error) {
    console.error('❌ Error en interacción:', error);
    
    try {
      const errorMessage = '❌ Error procesando la interacción. Inténtalo nuevamente en unos segundos.';
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.followup.send({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      console.error('❌ No se pudo enviar mensaje de error:', replyError);
    }
  }
});

// Manejo de errores del cliente
client.on('error', error => {
  console.error('❌ Error del cliente Discord:', error);
});

client.on('warn', info => {
  console.warn('⚠️ Advertencia Discord:', info);
});

client.on('disconnect', () => {
  console.warn('⚠️ Bot desconectado de Discord');
});

client.on('reconnecting', () => {
  console.log('🔄 Reconectando a Discord...');
});

// =========================
// FUNCIONES DEL BOT
// =========================

async function setupAttendancePanel(message) {
  const embed = new EmbedBuilder()
    .setTitle('🕐 SISTEMA DE CONTROL DE ASISTENCIA')
    .setDescription('**Registra tus eventos de trabajo con un solo clic:**')
    .setColor(0xffd700)
    .addFields([
      {
        name: '🟢 LOGIN - Entrada/Inicio de jornada',
        value: 'Presionarlo **apenas empieces tu turno** de trabajo.\nDebe ser lo **primero que hagas** al conectarte.\n⚠️ Si lo haces tarde, el sistema te registrará como **"Tarde"**.',
        inline: false
      },
      {
        name: '⏸️ BREAK - Inicio de pausa/descanso',
        value: 'Presionarlo **cada vez que te ausentes** del puesto (baño, comer, personal).\n❌ **No usarlo** si vas a estar solo 1-2 minutos.\n✅ **Solo para pausas de más de 5 minutos**.',
        inline: false
      },
      {
        name: '▶️ LOGOUT BREAK - Fin de pausa/vuelta al trabajo',
        value: 'Presionarlo **apenas vuelvas** de la pausa.\nEsto marca que estás **nuevamente disponible y activo**.',
        inline: false
      },
      {
        name: '🔴 LOGOUT - Salida/Fin de jornada + Reporte de Ventas',
        value: 'Presionarlo **al finalizar** tu turno.\n📋 **Se abrirá un formulario** para reportar ventas del día.\n⚠️ **OBLIGATORIO** completar el reporte de ventas.',
        inline: false
      },
      {
        name: '📋 REGLAS IMPORTANTES',
        value: '• Los botones se deben usar en **orden lógico**: `Login → Break → Logout Break → Logout`\n• **No marcar** un Break sin luego marcar un Logout Break\n• **El Logout incluye** el reporte obligatorio de ventas\n• Usar siempre desde el **mismo dispositivo** y cuenta de Discord asignada\n• **Activa los mensajes directos** para recibir confirmaciones',
        inline: false
      }
    ])
    .setFooter({ 
      text: '📧 Las confirmaciones llegan por DM | ⏰ Hora de Lima | 🚀 Powered by Render',
      iconURL: message.guild?.iconURL() || null
    })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('login')
        .setLabel('🟢 Login')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('break')
        .setLabel('⏸️ Break')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('logout_break')
        .setLabel('▶️ Logout Break')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('logout')
        .setLabel('🔴 Logout')
        .setStyle(ButtonStyle.Danger)
    );

  await message.channel.send({ embeds: [embed], components: [row] });
  
  // Eliminar comando para mantener limpio
  try {
    await message.delete();
  } catch (error) {
    console.warn('⚠️ No se pudo eliminar el mensaje de comando');
  }
}

async function handleButtonInteraction(interaction) {
  const { customId, user, guild, channel } = interaction;
  console.log(`🔘 Botón presionado: ${customId} por ${user.username}`);
  
  try {
    // Botón de logout - mostrar modal
    if (customId === 'logout') {
      const modal = new ModalBuilder()
        .setCustomId('logout_modal')
        .setTitle('LOGOUT - REPORTE DE VENTAS');

      const modeloInput = new TextInputBuilder()
        .setCustomId('modelo')
        .setLabel('MODELO')
        .setPlaceholder('Ingresa el modelo trabajado...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const montoBrutoInput = new TextInputBuilder()
        .setCustomId('monto_bruto')
        .setLabel('Monto Bruto:')
        .setPlaceholder('Ejemplo: 150.50')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      const fansSuscritosInput = new TextInputBuilder()
        .setCustomId('fans_suscritos')
        .setLabel('Fans Suscritos:')
        .setPlaceholder('Ejemplo: 25')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      const row1 = new ActionRowBuilder().addComponents(modeloInput);
      const row2 = new ActionRowBuilder().addComponents(montoBrutoInput);
      const row3 = new ActionRowBuilder().addComponents(fansSuscritosInput);

      modal.addComponents(row1, row2, row3);
      await interaction.showModal(modal);
      return;
    }

    // Mapeo de otros botones
    const actionMap = {
      'login': { action: 'login', emoji: '🟢', name: 'Login', color: 0x00ff00 },
      'break': { action: 'break', emoji: '⏸️', name: 'Break', color: 0x0099ff },
      'logout_break': { action: 'logout_break', emoji: '▶️', name: 'Logout Break', color: 0x9900ff }
    };

    const config = actionMap[customId];
    if (!config) {
      console.warn(`⚠️ CustomId desconocido: ${customId}`);
      return;
    }

    // Respuesta inmediata
    await interaction.reply({
      content: `${config.emoji} **${config.name}** procesando...`,
      ephemeral: true
    });

    // Enviar a Google Sheets
    const success = await sendToGoogleSheets(user, config.action, guild, channel);
    
    // Crear embed de confirmación
    const embed = new EmbedBuilder()
      .setTitle(`${config.emoji} ${config.name} Registrado`)
      .setDescription(`**${config.name} registrado exitosamente**`)
      .setColor(config.color)
      .addFields([
        { name: '👤 Usuario', value: `${user.username}`, inline: true },
        { name: '⏰ Hora (Lima)', value: `${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`, inline: true }
      ])
      .setTimestamp();

    if (success) {
      embed.setFooter({ text: '✅ Registro actualizado en Google Sheets' });
    } else {
      embed.setFooter({ text: '⚠️ Error guardando en Google Sheets' });
    }

    // Actualizar respuesta y eliminar después de 5 segundos
    await interaction.editReply({
      content: `${config.emoji} **${config.name}** registrado exitosamente`,
      embeds: [embed]
    });
    
    // Eliminar mensaje después de 5 segundos para no llenar el canal
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar mensaje de confirmación');
      }
    }, 5000);

    // Enviar por DM
    try {
      await user.send({ content: `${config.emoji} **${config.name}** registrado exitosamente`, embeds: [embed] });
      console.log(`✉️ DM enviado a ${user.username}`);
    } catch (dmError) {
      console.warn(`⚠️ No se pudo enviar DM a ${user.username}: ${dmError.message}`);
    }

    console.log(`✅ ${config.name} registrado para ${user.username}`);

  } catch (error) {
    console.error(`❌ Error en botón ${customId}:`, error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `❌ Error procesando **${customId}**. Inténtalo nuevamente.`,
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('❌ Error enviando respuesta de error:', replyError);
    }
  }
}

async function handleModalSubmit(interaction) {
  if (interaction.customId !== 'logout_modal') return;

  try {
    console.log(`📝 Modal de ventas enviado por ${interaction.user.username}`);
    
    // Respuesta inmediata
    await interaction.reply({
      content: '🔴 **Procesando logout y reporte de ventas...** ⏳',
      ephemeral: true
    });

    // Obtener datos del modal
    const modelo = interaction.fields.getTextInputValue('modelo');
    const montoBrutoStr = interaction.fields.getTextInputValue('monto_bruto').replace(/[$,]/g, '').trim();
    const fansSuscritosStr = interaction.fields.getTextInputValue('fans_suscritos').replace(/[#,]/g, '').trim();

    // Validaciones
    const montoBruto = parseFloat(montoBrutoStr);
    if (isNaN(montoBruto) || montoBruto < 0) {
      await interaction.editReply({ 
        content: '❌ **Error**: El monto bruto debe ser un número válido mayor o igual a 0.' 
      });
      return;
    }

    const montoNeto = montoBruto * 0.80;

    const fansSuscritos = parseInt(fansSuscritosStr);
    if (isNaN(fansSuscritos) || fansSuscritos < 0) {
      await interaction.editReply({ 
        content: '❌ **Error**: Los fans suscritos deben ser un número entero mayor o igual a 0.' 
      });
      return;
    }

    // Datos de ventas
    const ventasData = { 
      modelo, 
      monto_bruto: montoBruto, 
      monto_neto: montoNeto, 
      fans_suscritos: fansSuscritos 
    };

    // Enviar a Google Sheets
    const success = await sendToGoogleSheets(
      interaction.user,
      'logout',
      interaction.guild,
      interaction.channel,
      ventasData
    );

    // Crear embed de respuesta
    const embed = new EmbedBuilder()
      .setTitle('🔴 Logout y Ventas Registrados')
      .setDescription('**Jornada finalizada con reporte de ventas**')
      .setColor(0xff0000)
      .addFields([
        { name: '👤 Usuario', value: `${interaction.user.username}`, inline: true },
        { name: '📝 Modelo', value: `${modelo}`, inline: true },
        { name: '💵 Monto Bruto', value: `$${montoBruto.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, inline: true },
        { name: '💰 Monto Neto (80%)', value: `$${montoNeto.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, inline: true },
        { name: '👥 Fans Suscritos', value: `${fansSuscritos.toLocaleString()}`, inline: true },
        { name: '⏰ Hora (Lima)', value: `${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })}`, inline: true }
      ])
      .setTimestamp();

    if (success) {
      embed.setFooter({ text: '✅ Logout y ventas registrados en Google Sheets' });
    } else {
      embed.setFooter({ text: '⚠️ Error guardando en Google Sheets' });
    }

    // Actualizar respuesta y eliminar después de 8 segundos
    await interaction.editReply({
      content: success ? 
        '🔴 **Logout registrado exitosamente con reporte de ventas**' : 
        '⚠️ **Logout registrado localmente** (error con Google Sheets)',
      embeds: [embed]
    });
    
    // Eliminar mensaje después de 8 segundos para no llenar el canal
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        console.warn('⚠️ No se pudo eliminar mensaje de logout');
      }
    }, 8000);

    // Enviar por DM
    try {
      await interaction.user.send({
        content: '🔴 **Logout y reporte de ventas registrado**',
        embeds: [embed]
      });
      console.log(`✉️ DM de logout enviado a ${interaction.user.username}`);
    } catch (dmError) {
      console.warn('⚠️ No se pudo enviar DM de logout');
    }

    console.log(`✅ Logout con ventas registrado para ${interaction.user.username}`);

  } catch (error) {
    console.error('❌ Error en modal de logout:', error);
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ **Error procesando logout**. Inténtalo nuevamente.'
        });
      }
    } catch (editError) {
      console.error('❌ Error editando respuesta de modal:', editError);
    }
  }
}

async function sendToGoogleSheets(user, action, guild, channel, ventasData = null) {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn('⚠️ Google Sheets URL no configurada');
    return false;
  }

  try {
    const data = {
      timestamp: new Date().toISOString(),
      usuario: `${user.username}#${user.discriminator}`,
      action: action,
      servidor: guild?.name || 'DM/Privado',
      canal: channel?.name || 'Mensaje Directo',
      ...ventasData
    };

    console.log(`📊 Enviando a Google Sheets: ${user.username} - ${action}`);

    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000)
    });

    if (response.ok) {
      const result = await response.json();
      if (result.result === 'success') {
        console.log(`✅ Google Sheets actualizado: ${user.username} - ${action}`);
        return true;
      } else {
        console.error('❌ Google Sheets rechazó los datos:', result);
        return false;
      }
    } else {
      console.error(`❌ Google Sheets HTTP ${response.status}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error enviando a Google Sheets:', error.message);
    return false;
  }
}

// =========================
// CONECTAR BOT
// =========================
console.log('🔗 Conectando a Discord...');
client.login(DISCORD_TOKEN).catch(error => {
  console.error('❌ Error conectando el bot:', error);
  process.exit(1);
});
