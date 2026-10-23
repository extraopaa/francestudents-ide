"use strict";
const path=require("node:path");
const {execFileSync}=require("node:child_process");

// No encryption key is stored beside the data. Windows CLI and Electron share
// DPAPI CurrentUser; macOS/Linux desktop uses Electron's OS-backed safeStorage.
function windowsDpapi(value,decrypt){
    const operation=decrypt?"Unprotect":"Protect";
    const input=decrypt?"[Convert]::FromBase64String($inputData)":"[Text.Encoding]::UTF8.GetBytes($inputData)";
    const output=decrypt?"[Text.Encoding]::UTF8.GetString($result)":"[Convert]::ToBase64String($result)";
    const script=`$ErrorActionPreference='Stop';[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Add-Type -AssemblyName System.Security;$inputData=[Console]::In.ReadToEnd();$result=[Security.Cryptography.ProtectedData]::${operation}(${input},$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write(${output})`;
    return execFileSync(path.join(process.env.SystemRoot||"C:\\Windows","System32/WindowsPowerShell/v1.0/powershell.exe"),["-NoProfile","-NonInteractive","-Command",script],{input:value,encoding:"utf8",windowsHide:true,timeout:10000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"]});
}
function createSecretStorage({platform=process.platform,safeStorage=null,dpapi=windowsDpapi}={}){
    let lastEncrypted=null,lastPlain=null;
    function backend(){
        if(platform==="win32")return "windows-dpapi";
        try{if(safeStorage?.isEncryptionAvailable()&&(platform!=="linux"||!["basic_text","unknown"].includes(safeStorage.getSelectedStorageBackend())))return "electron-safeStorage";}catch{/* locked or unavailable keychain */}
        return null;
    }
    return {
        available:()=>Boolean(backend()),
        protect(value){
            const type=backend();if(!type)return null;
            try{
                const data=type==="windows-dpapi"?dpapi(String(value),false):safeStorage.encryptString(String(value)).toString("base64");
                const result={format:"os-secret-v1",backend:type,data};
                lastEncrypted=JSON.stringify(result);lastPlain=String(value);return result;
            }catch{throw new Error("Le coffre système n’a pas pu protéger les identifiants. Aucun secret n’a été enregistré en clair.");}
        },
        unprotect(secret){
            if(secret?.format!=="os-secret-v1"||secret.backend!==backend()||typeof secret.data!=="string"||secret.data.length>2*1024*1024)return null;
            const encoded=JSON.stringify(secret);if(lastEncrypted===encoded)return lastPlain;
            try{
                const value=secret.backend==="windows-dpapi"?dpapi(secret.data,true):safeStorage.decryptString(Buffer.from(secret.data,"base64"));
                lastEncrypted=encoded;lastPlain=value;return value;
            }catch{return null;}
        }
    };
}
let storage=createSecretStorage();
module.exports={createSecretStorage,configure:options=>{storage=createSecretStorage(options);},available:()=>storage.available(),protect:value=>storage.protect(value),unprotect:value=>storage.unprotect(value)};
