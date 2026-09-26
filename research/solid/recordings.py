"""Ring tones in tap recordings: frequency, early and late level, decay time and Q per tone.
Usage: python3 recordings.py tap-1.wav tap-2.wav ...   (numpy, scipy)
A tone is listed when it stands out in the 20-120 ms window and still stands 10 dB above its neighbourhood 120-220 ms
after the strike (strike noise does not persist); its decay is fitted from a narrow complex demodulation.
Grip-damped modes (for a centre support, the axisymmetric (0,s) and tilting (1,s) modes) show a much lower Q.
tau = inf means the level did not fall over 30-500 ms: energy exchange inside a split pair, or device gain control."""
import sys, numpy as np, scipy.io.wavfile as wavfile, scipy.signal as ss
def load(path):
    sr,x=wavfile.read(path); x=x.astype(float)
    if x.ndim>1: x=x[:,0]
    x/=np.abs(x).max() or 1; on=int(np.argmax(np.abs(x)>.3)); return sr,x,on
def spectrum(seg,sr,nfft=1<<19):
    X=np.abs(np.fft.rfft(seg*ss.windows.blackmanharris(len(seg)),nfft)); return np.fft.rfftfreq(nfft,1/sr),X
def decay(x,sr,on,f):
    n=np.arange(len(x)); z=x*np.exp(-2j*np.pi*f*n/sr); b,a=ss.butter(4,min(60,f*.004)/(sr/2)); env=20*np.log10(np.abs(ss.filtfilt(b,a,z))+1e-12)
    t=(n-on)/sr; noise=np.median(env[(t<-.02)&(t>-.08)]) if on>.08*sr else env.min(); ok=(t>.03)&(t<.5)&(env>noise+10)
    if ok.sum()<200: return None
    slope=np.polyfit(t[ok],env[ok],1)[0]; tau=-20/np.log(10)/slope if slope<0 else np.inf; return tau,np.pi*f*tau
for path in sys.argv[1:]:
    sr,x,on=load(path); f,E=spectrum(x[on+int(.02*sr):on+int(.12*sr)],sr); _,L=spectrum(x[on+int(.2*sr):on+int(.5*sr)],sr)
    Edb=20*np.log10(E/E.max()+1e-15); Ldb=20*np.log10(L/L.max()+1e-15)
    _,M=spectrum(x[on+int(.12*sr):on+int(.22*sr)],sr); Mdb=20*np.log10(M/M.max()+1e-15); df=f[1]-f[0]
    def persists(p):
        w=int(300/df); lo,hi=max(0,p-w),p+w; local=np.median(Mdb[lo:hi]); return Mdb[max(0,p-int(4/df)):p+int(4/df)+1].max()-local>=10
    pk,_=ss.find_peaks(Edb,prominence=15,height=-50); pk=[p for p in pk if persists(p)]; print(f'--- {path}: {sr} Hz, onset {on/sr*1e3:.0f} ms')
    print('   f (Hz)   early dB   late dB   tau (ms)     Q')
    for p in pk:
        if f[p]<700: continue
        d=decay(x,sr,on,f[p]); tau,Q=d if d else (np.nan,np.nan)
        print(f'{f[p]:9.1f} {Edb[p]:9.1f} {Ldb[max(0,p-20):p+20].max():9.1f} {tau*1e3:9.0f} {Q:8.0f}')
