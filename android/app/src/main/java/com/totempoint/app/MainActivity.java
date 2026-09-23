package com.totempoint.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import dev.duma.capacitor.bluetoothprinter.BluetoothPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registro explícito del plugin de impresión: su package apunta a
        // Capacitor 6, así que el auto-registro de Capacitor 8 puede no tomarlo.
        registerPlugin(BluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
