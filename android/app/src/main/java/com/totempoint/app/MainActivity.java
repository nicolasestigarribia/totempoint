package com.totempoint.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import dev.duma.capacitor.bluetoothprinter.BluetoothPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registro explícito del plugin de impresión: su package apunta a
        // Capacitor 6, así que el auto-registro de Capacitor 8 puede no tomarlo.
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
        pedirPermisosBluetooth();
    }

    // En Android 12+ (API 31) "dispositivos cercanos" son permisos en tiempo de
    // ejecución. Sin esto hay que darlos a mano en Ajustes y recién ahí aparece
    // la impresora. Se piden al arrancar; en versiones anteriores no hacen falta.
    private void pedirPermisosBluetooth() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;

        String[] permisos = {
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
        };

        boolean faltaAlguno = false;
        for (String p : permisos) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                faltaAlguno = true;
                break;
            }
        }

        if (faltaAlguno) {
            ActivityCompat.requestPermissions(this, permisos, 1001);
        }
    }
}
