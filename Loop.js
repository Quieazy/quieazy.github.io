class Loop
{
    static #loaded = false;
    static #noRAF = false;
    static #callUpdate = false;
    static #frameIndex = 0;
    static #uTime = 0;
    static #uDeltaTime = 0;
    static #time = 0;
    static #deltaTime = 0;
    static #calls = [];

    static get #supportsScheduler ()
    {
        return scheduler != null;
    }
    
    static targetFrameRate = -1;
    static vSyncCount = 1;
    static timeScale = 1;
    static maximumDeltaTime = 0.1111111;
    
    static get frameCount ()
    {
        return this.#frameIndex;
    }
    
    static get unscaledTime ()
    {
        return this.#uTime;
    }
    
    static get unscaledDeltaTime ()
    {
        return this.#uDeltaTime;
    }
    
    static get time ()
    {
        return this.#time;
    }
    
    static get deltaTime ()
    {
        return this.#deltaTime;
    }
    
    static #RequestUpdate ()
    {
        const vsyncCall = callback => {
            if (this.#noRAF) setTimeout(callback, 0);
            else requestAnimationFrame(callback);
        };

        if (this.targetFrameRate === 0 || this.vSyncCount === 1) vsyncCall(this.#Update.bind(this));
        else if (this.vSyncCount === 2) vsyncCall(() => vsyncCall(this.#Update.bind(this)));
        else if (this.targetFrameRate === -1 || !this.#supportsScheduler) setTimeout(this.#Update.bind(this), 0);
        else scheduler.postTask(this.#Update.bind(this));
    }

    static #UpdateBase ()
    {
        this.#uDeltaTime = (1e-3 * performance.now()) - this.#uTime;
        this.#uTime += this.#uDeltaTime;
            
        let deltaT = this.#uDeltaTime;
            
        if (deltaT > this.maximumDeltaTime) deltaT = this.maximumDeltaTime;
            
        this.#deltaTime = deltaT * this.timeScale;
        this.#time += this.#deltaTime;
                    
        this.#frameIndex++;

        this.#callUpdate = true;
    }
    
    static #Update (vsyncTime)
    {
        if (vsyncTime > 0 && this.#noRAF) return;

        if (this.targetFrameRate > 0 && this.vSyncCount === 0)
        {
            const slice = (1 / this.targetFrameRate) - (+!this.#supportsScheduler * 5e-3);
                    
            let accumulator = (1e-3 * performance.now()) - this.#uTime;
        
            while (accumulator >= slice)
            {
                this.#UpdateBase();
            
                accumulator -= slice;
            }
        }
        else this.#UpdateBase();

        if (!this.#callUpdate)
        {
            this.#RequestUpdate();
            return;
        }

        for (let i = 0; i < this.#calls.length; i++)
        {
            const currentCall = this.#calls[i];
            
            currentCall.time += this.#deltaTime;
            
            if (currentCall.time <= currentCall.timeout) continue;
            
            currentCall.callback();
            
            if (currentCall.clear()) this.#calls.splice(this.#calls.indexOf(currentCall), 1);
            else currentCall.time = 0;
        }

        this.#callUpdate = false;
        
        this.#RequestUpdate();
    }
    
    static Init ()
    {
        if (this.#loaded) return;
        
        this.#loaded = true;

        setInterval(() => {
            if (this.#noRAF === !document.hasFocus()) return;

            this.#noRAF = !document.hasFocus();

            if (this.vSyncCount > 0 && this.#noRAF) this.#RequestUpdate();
        }, 0);
        
        this.#RequestUpdate();
    }
    
    static Append (callback, delay, shouldClear)
    {
        this.#calls.push({
            callback : callback,
            clear : shouldClear ?? (() => false),
            timeout : delay ?? 0,
            time : 0
        });
    }
    
    static async Delay (time)
    {
        if (time === 0) return;
        
        let done = false;
        
        return new Promise(resolve => this.Append(() => {
            done = true;
            
            resolve();
        }, time, () => done));
    }

    static async Wait (conditionCall)
    {
        const loop = callback => {
            if (conditionCall())
            {
                callback();
    
                return;
            }
    
            if (this.#supportsScheduler) scheduler.postTask(loop.bind(this, callback));
            else setTimeout(loop.bind(this, callback), 0);
        };
    
        await new Promise(resolve => loop(resolve));
    }
}

Loop.Init();