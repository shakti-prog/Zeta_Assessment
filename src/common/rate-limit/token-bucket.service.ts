import { Injectable } from "@nestjs/common";

type Bucket = { tokens: number; lastRequestTime: number };

@Injectable()
export class TokenBucketService {
  private readonly CAPACITY = 5;
  private readonly RATE = 5;                
  private readonly REFILL_TIME = 1000;       
  private readonly bucket = new Map<string, Bucket>();

  allow(key: string): boolean {
    const now = Date.now();
    const b = this.bucket.get(key) ?? { tokens: this.CAPACITY, lastRequestTime: now };

    const elapsed = (now - b.lastRequestTime) / this.REFILL_TIME; 
    if (elapsed > 0) {
      b.tokens = Math.min(this.CAPACITY, b.tokens + elapsed * this.RATE);
      b.lastRequestTime = now;
    }

    if (b.tokens < 1) {            
      this.bucket.set(key, b);
      return false;
    }

    b.tokens -= 1;
    this.bucket.set(key, b);
    return true;
  }
}