'use strict';
const $ = id => document.getElementById(id);
const labels={happy:'Mutlu',neutral:'Nötr',sad:'Üzgün',surprised:'Şaşkın',angry:'Öfkeli',fearful:'Korkmuş',disgusted:'İğrenmiş'};
const video=$('video'), canvas=$('overlay'), button=$('toggle');
let stream=null, running=false, generation=0, loaded=false, loading=false;
for(const [key,label] of Object.entries(labels)) $('scores').insertAdjacentHTML('beforeend',`<div class="score"><div class="score-label"><span>${label}</span><span id="value-${key}">—</span></div><div class="track"><div class="fill" id="bar-${key}"></div></div></div>`);
function resetResults(title='Henüz bir tahmin yok.',hint='Kamera açıldığında sonuçlar burada görünecek.') { $('prediction').textContent=title;$('hint').textContent=hint;for(const key of Object.keys(labels)){$('value-'+key).textContent='—';$('bar-'+key).style.width='0%';}canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height); }
function stop(message='Kamera durduruldu.') { generation++;running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('empty').hidden=false;$('empty').style.display='flex';$('camera-state').textContent='Kamera kapalı';$('status').textContent=message;button.disabled=false;button.textContent='Kamerayı aç ↗';resetResults(); }
async function start(){
 if(running||loading)return;loading=true;button.disabled=true;const token=++generation;
 try{
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
  $('status').textContent='Küçük modeller hazırlanıyor… İlk açılış biraz sürebilir.';
  if(!window.faceapi)throw new Error('model');
  if(!loaded){await Promise.all([faceapi.nets.tinyFaceDetector.loadFromUri('./models'),faceapi.nets.faceExpressionNet.loadFromUri('./models')]);loaded=true;}
  if(token!==generation)return;
  $('status').textContent='Tarayıcındaki kamera iznini onayla.';
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
  if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
  stream=acquired;video.srcObject=stream;await video.play();
  if(token!==generation)return;
  running=true;canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;
  $('empty').style.display='none';$('camera-state').textContent='Kamera açık';$('status').textContent='Yüzünü kameraya dönük tut.';button.textContent='Kamerayı durdur';button.disabled=false;
  stream.getVideoTracks()[0].addEventListener('ended',()=>{if(running)stop('Kamera bağlantısı kesildi. Yeniden deneyebilirsin.');});
  void detect(token);
 }catch(err){stop(errorMessage(err));}finally{loading=false;if(!running)button.disabled=false;}
}
function errorMessage(err){ if(err.name==='NotAllowedError')return 'Kamera izni verilmedi. Adres çubuğundaki kamera ayarından izin verip tekrar dene.';if(err.name==='NotFoundError')return 'Kamera bulunamadı. Kameranın bağlı olduğunu kontrol et.';if(err.name==='NotReadableError')return 'Kamera açılamadı. Kamerayı kullanan başka uygulamaları kapatıp tekrar dene.';if(err.message==='unsupported')return 'Kamera bu görünümde desteklenmiyor. Bağlantıyı Chrome veya Safari’de HTTPS üzerinden aç.';return 'Model veya kamera başlatılamadı. Bağlantını kontrol edip tekrar dene; gerekirse Chrome veya Safari’de aç.';}
async function detect(token){
 if(!running||generation!==token)return;
 try{
  const result=await faceapi.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions({inputSize:224,scoreThreshold:.5})).withFaceExpressions();
  if(!running||generation!==token)return;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!result){resetResults('Yüz aranıyor…','Tek yüzle, iyi aydınlatılmış bir ortamda dene.');$('status').textContent='Yüzün kamera içinde görünür olmalı.';}
  else{
   const {x,y,width,height}=result.detection.box;ctx.strokeStyle='#a4ef80';ctx.lineWidth=3;ctx.strokeRect(x,y,width,height);
   const sorted=Object.entries(result.expressions).sort((a,b)=>b[1]-a[1]);const [key,score]=sorted[0];
   $('prediction').textContent=score<.5?'Belirsiz':labels[key];$('hint').textContent=score<.5?'Model net bir ifade ayıramadı.':'Görünür yüz ifadesine ait anlık model tahmini.';$('status').textContent='Yüz bulundu · Canlı analiz';
   for(const k of Object.keys(labels)){const pct=Math.round(result.expressions[k]*100);$('value-'+k).textContent=pct+'%';$('bar-'+k).style.width=pct+'%';}
  }
  setTimeout(()=>void detect(token),140);
 }catch(err){if(token===generation)stop('Analiz durdu. Kamerayı yeniden başlatarak tekrar deneyebilirsin.');}
}
button.addEventListener('click',()=>running?stop():void start());
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||loading))stop('Sekmeden ayrıldığın için kamera durduruldu.');});
const registry=document.modelContext;
if(registry?.registerTool){const controller=new AbortController();try{Promise.resolve(registry.registerTool({name:'stop_camera',description:'Stop the camera and clear current expression results.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected empty object');stop();return {camera:'stopped'};}},{signal:controller.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>controller.abort(),{once:true});}
