import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PaymentsModule } from "./payments/payments.module";
import { StoreModule } from "./store/ store.module";
import { MetricsModule } from "./metrics/metrics.module";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsInterceptor } from "./metrics/metrics.interceptor";
import { AppLoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StoreModule,
    PaymentsModule,
    MetricsModule,
    AppLoggerModule
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
