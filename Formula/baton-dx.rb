class BatonDx < Formula
  desc "CLI package manager for Developer Experience & AI configuration"
  homepage "https://github.com/baton-dx/baton-dx"
  url "https://registry.npmjs.org/@baton-dx/cli/-/cli-0.6.1.tgz"
  sha256 "4bed302e54a42921cd194488c2a528c950e424ce2ab923262c57e584a28f11f3"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/baton --version")
  end
end
