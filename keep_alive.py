#!/usr/bin/env python3
"""
Keep-alive script para mantener el Repl activo 24/7
Hacer ping cada 5 minutos para evitar que se duerma
"""

import requests
import time
import os
from datetime import datetime

def get_repl_url():
    """Obtiene la URL del Repl automáticamente"""
    repl_slug = os.getenv('REPL_SLUG', 'discord-bot')
    repl_owner = os.getenv('REPL_OWNER', 'tu-usuario')
    return f"https://{repl_slug}.{repl_owner}.repl.co"

def ping_repl():
    """Hace ping al Repl para mantenerlo activo"""
    url = get_repl_url()
    
    try:
        print(f"🏓 Haciendo ping a {url}")
        response = requests.get(f"{url}/ping", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Ping exitoso: {data.get('ping', 'pong')}")
            print(f"⏰ Uptime: {data.get('uptime', 0)} segundos")
            return True
        else:
            print(f"⚠️ HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error en ping: {e}")
        return False

def main():
    """Función principal del keep-alive"""
    print("🚀 Iniciando keep-alive para Repl...")
    print(f"🌐 URL objetivo: {get_repl_url()}")
    print("💓 Ping cada 5 minutos para mantener activo")
    print("-" * 50)
    
    while True:
        try:
            # Mostrar timestamp
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{now}] Keep-alive ejecutándose...")
            
            # Hacer ping
            success = ping_repl()
            
            if success:
                print("✅ Repl manteniéndose activo")
            else:
                print("⚠️ Ping falló, pero continuando...")
            
            # Esperar 5 minutos (300 segundos)
            print("😴 Durmiendo 5 minutos...")
            time.sleep(300)
            
        except KeyboardInterrupt:
            print("\n🛑 Keep-alive detenido por el usuario")
            break
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            print("🔄 Continuando en 30 segundos...")
            time.sleep(30)

if __name__ == "__main__":
    main()
