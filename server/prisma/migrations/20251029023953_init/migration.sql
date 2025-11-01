-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL,
    "esVip" BOOLEAN NOT NULL,
    "reservasCount" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asiento" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clase" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Asiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservacion" (
    "id" SERIAL NOT NULL,
    "estado" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "asiento" TEXT NOT NULL,
    "pasajeroNombre" TEXT NOT NULL,
    "pasajeroCui" TEXT NOT NULL,
    "pasajeroEquipaje" BOOLEAN NOT NULL,
    "fechaReservacion" TIMESTAMP(3) NOT NULL,
    "metodoSeleccion" TEXT NOT NULL,
    "precioBase" DOUBLE PRECISION NOT NULL,
    "precioTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Reservacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modificacion" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "recargo" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT NOT NULL,
    "reservacionId" INTEGER NOT NULL,

    CONSTRAINT "Modificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asiento_numero_key" ON "Asiento"("numero");

-- AddForeignKey
ALTER TABLE "Modificacion" ADD CONSTRAINT "Modificacion_reservacionId_fkey" FOREIGN KEY ("reservacionId") REFERENCES "Reservacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
