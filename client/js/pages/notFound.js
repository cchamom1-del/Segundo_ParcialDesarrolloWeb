export default async function NotFound(root) {
  root.innerHTML = `<section class="container empty-state big">
    <h1>Esta página no existe</h1>
    <p>Puede que el enlace esté incompleto o que el vehículo ya no esté publicado.</p>
    <a class="btn btn-primary" href="/">Ir al inventario</a>
  </section>`;
}
