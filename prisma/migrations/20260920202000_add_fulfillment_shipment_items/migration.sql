CREATE TABLE "FulfillmentShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentShipmentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FulfillmentShipmentItem_shipmentId_orderItemId_key"
ON "FulfillmentShipmentItem"("shipmentId", "orderItemId");

CREATE INDEX "FulfillmentShipmentItem_orderItemId_idx"
ON "FulfillmentShipmentItem"("orderItemId");

ALTER TABLE "FulfillmentShipmentItem"
ADD CONSTRAINT "FulfillmentShipmentItem_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "FulfillmentShipment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FulfillmentShipmentItem"
ADD CONSTRAINT "FulfillmentShipmentItem_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
